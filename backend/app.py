# app.py

import uvicorn
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import cv2
import numpy as np
from tensorflow.keras.models import load_model
import json
import tempfile
import logging

# 로거 설정
logging.basicConfig(
    level=logging.DEBUG,  # 디버그 레벨로 설정하여 상세한 로그 출력
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# 모델 로드
try:
    model = load_model('sign_language_model.keras')
    logger.info("모델 로드 완료")
except Exception as e:
    logger.error(f"모델 로드 실패: {e}")
    raise

# 클래스 레이블 로드
try:
    with open('class_labels.json', 'r', encoding='utf-8') as f:
        class_labels = json.load(f)
    logger.info("클래스 레이블 로드 완료")
except Exception as e:
    logger.error(f"클래스 레이블 로드 실패: {e}")
    raise

app = FastAPI()

# CORS 설정 (필요한 경우)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # 추가 도메인
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 도메인 허용 (필요에 따라 origins로 변경)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 예측 API 엔드포인트 정의
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    logger.info("예측 요청 수신")
    try:
        logger.info(f"수신된 파일 타입: {file.content_type}")

        # 파일 타입 확인
        if file.content_type not in ["video/mp4", "video/mpeg", "video/avi", "video/quicktime", "application/octet-stream"]:
            error_message = f"지원하지 않는 파일 형식입니다. 수신된 타입: {file.content_type}"
            logger.error(error_message)
            return JSONResponse(status_code=400, content={"detail": error_message})

        # 파일 읽기
        video_bytes = await file.read()
        logger.info("파일 읽기 완료")

        # 예측 수행
        predicted_label = predict_sign_language(video_bytes)
        logger.info("예측 수행 완료")

        # 결과 반환
        return {"predicted_label": predicted_label}

    except Exception as e:
        import traceback
        traceback_str = ''.join(traceback.format_tb(e.__traceback__))
        error_message = f"예측 중 오류 발생: {str(e)}\nTraceback:\n{traceback_str}"
        logger.error(error_message)
        return JSONResponse(status_code=500, content={"detail": error_message})

# 수어 예측 함수 (일정 간격으로 프레임 추출)
def predict_sign_language(video_bytes, num_frames=30):
    logger.info("예측 함수 시작")
    predictions = []

    # 임시 파일 저장
    try:
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_file:
            tmp_file.write(video_bytes)
            temp_video_path = tmp_file.name
        logger.info(f"임시 비디오 파일 저장 완료: {temp_video_path}")
    except Exception as e:
        logger.error(f"임시 비디오 파일 저장 실패: {e}")
        raise

    try:
        # 영상 읽기
        cap = cv2.VideoCapture(temp_video_path)
        if not cap.isOpened():
            logger.error("영상 열기 실패")
            os.remove(temp_video_path)
            raise ValueError("영상을 열 수 없습니다.")
        logger.info("영상 열기 성공")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = total_frames / fps if fps else 0
        # logger.info(f"총 프레임 수: {total_frames}, FPS: {fps}, 영상 길이: {duration}초")

        if total_frames == 0 or duration == 0:
            cap.release()
            os.remove(temp_video_path)
            raise ValueError("영상에 프레임이 없습니다.")

        # 일정 간격으로 추출할 프레임의 타임스탬프 계산
        timestamps = np.linspace(0, duration, num=num_frames+2)[1:-1]  # 시작과 끝을 제외하고 균등하게 분할
        # logger.info(f"추출할 타임스탬프: {timestamps}")

        for timestamp in timestamps:
            cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)  # 타임스탬프로 위치 설정 (밀리초 단위)
            ret, frame = cap.read()
            if not ret:
                logger.warning(f"{timestamp}초 위치에서 프레임을 읽지 못했습니다.")
                continue

            # logger.info(f"{timestamp}초 위치의 프레임 처리 중")
            img = cv2.resize(frame, (224, 224))
            img = img / 255.0
            img = np.expand_dims(img, axis=0)

            # 예측 수행
            pred = model.predict(img)
            # logger.debug(f"예측 결과: {pred}")
            predictions.append(pred)

        cap.release()

    except Exception as e:
        logger.error(f"영상 처리 중 오류 발생: {e}")
        raise

    finally:
        # 임시 파일 삭제
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)
            logger.info("임시 비디오 파일 삭제 완료")

    if not predictions:
        raise ValueError("예측할 프레임이 없습니다.")

    # 예측 결과 결합
    predictions = np.mean(predictions, axis=0)
    # logger.debug(f"평균 예측 결과: {predictions}")

    predicted_class_index = np.argmax(predictions)
 
    # 클래스 레이블 확인
    # logger.debug(f"클래스 레이블: {class_labels}")

    predicted_label = class_labels.get(str(predicted_class_index), None)
    if predicted_label is None:
        error_message = f"예측된 클래스 인덱스 {predicted_class_index}에 해당하는 레이블이 없습니다."
        logger.error(error_message)
        raise ValueError(error_message)

    logger.info(f"예측된 클래스 인덱스와 레이블: {predicted_class_index}, {predicted_label}")

    return predicted_label

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")