"use client";

import { useRef, useState, useEffect } from "react";
import axios from "axios";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);
  const [videoSource, setVideoSource] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 미리 준비된 비디오 리스트
  const videoList = [
    { name: "-ㅂ니까", url: "/videos/-ㅂ니까.mp4" },
    { name: "-ㅂ니다", url: "/videos/-ㅂ니다.mp4" },
    { name: "가래", url: "/videos/가래.mp4" },
    { name: "가만있다", url: "/videos/가만있다.mp4" },
    { name: "가지다", url: "/videos/가지다.mp4" },
    { name: "간호", url: "/videos/간호.mp4" },
    { name: "간호사", url: "/videos/간호사.mp4" },
    { name: "갈비뼈", url: "/videos/갈비뼈.mp4" },
    { name: "감기", url: "/videos/감기.mp4" },
    { name: "감염", url: "/videos/감염.mp4" },
    { name: "갑갑하다", url: "/videos/갑갑하다.mp4" },
    { name: "거북하다", url: "/videos/거북하다.mp4" },
    { name: "건강", url: "/videos/건강.mp4" },
    { name: "건강보험", url: "/videos/건강보험.mp4" },
  ];

  // 비디오 업로드 또는 선택 시 비디오 재생
  useEffect(() => {
    if (videoRef.current && videoSource) {
      videoRef.current.load();
      videoRef.current.play();
    }
  }, [videoSource]);

  // 비디오 파일 업로드 처리
  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setSelectedFile(file);

      const videoURL = URL.createObjectURL(file);
      setVideoSource(videoURL);
    }
  };

  // 준비된 비디오 선택 처리
  const handleVideoSelect = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const url = event.target.value;
    if (url) {
      setVideoSource(url);

      // 비디오를 Blob으로 가져와서 selectedFile에 저장
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], "selected_video.mp4", {
          type: blob.type,
        });
        setSelectedFile(file);
      } catch (error) {
        console.error("비디오 로드 오류:", error);
      }
    }
  };

  // 비디오가 끝날 때 무한 재생
  const handleVideoEnd = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0; // 비디오를 처음으로 되돌림
      videoRef.current.play(); // 비디오 다시 재생
    }
  };

  // 비디오 파일을 서버에 전송
  const sendVideoToServer = async () => {
    if (selectedFile) {
      const formData = new FormData();
      formData.append("file", selectedFile);

      try {
        setIsLoading(true); // 로딩 시작
        const response = await axios.post(
          "http://localhost:8000/predict",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        setResult(response.data.predicted_label ?? "예측 실패");
      } catch (error) {
        console.error("예측 요청 오류:", error);
        setResult("예측 요청 중 오류 발생");
      } finally {
        setIsLoading(false); // 로딩 종료
      }
    } else {
      setResult("비디오를 선택하거나 업로드해주세요.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#A7C7E7] to-[#C1E1C1] p-8 text-gray-800">
      {/* 제목 */}
      <h1 className="text-4xl font-gangwon font-bold mb-4 text-gray-700">
        청각장애인을 위한 진료 상황 수어 번역기
      </h1>

      <h1 className="text-3xl font-semibold mb-4 text-gray-700">sAIgn</h1>

      {/* 비디오 업로드 또는 선택 */}
      <div className="w-full max-w-md mb-6">
        <h2 className="text-2xl font-gangwon font-semibold mb-4 text-gray-700 text-center">
          비디오 업로드 또는 선택
        </h2>
        {/* 비디오 업로드 */}
        <input
          type="file"
          accept="video/*"
          onChange={handleVideoUpload}
          className="w-full p-2 border font-gangwon rounded-lg shadow-sm text-center mb-4"
        />
        <p className="text-center text-gray-600 mb-2">또는</p>
        {/* 비디오 선택 드롭다운 */}
        <select
          className="w-full p-2 border font-gangwon rounded-lg shadow-sm text-center"
          onChange={handleVideoSelect}
        >
          <option value="">비디오를 선택하세요</option>
          {videoList.map((video, index) => (
            <option key={index} value={video.url}>
              {video.name}
            </option>
          ))}
        </select>
      </div>

      {/* 비디오 플레이어 */}
      <div className="relative w-[640px] h-[400px] bg-gray-200 border-4 border-[#B4E0D9] rounded-lg overflow-hidden shadow-lg mb-6">
        <video
          ref={videoRef}
          src={videoSource}
          controls
          muted
          className="w-full h-full object-cover"
          onEnded={handleVideoEnd}
        />
      </div>

      {/* 번역 버튼 */}
      <button
        onClick={sendVideoToServer}
        className={`bg-[#B4E0D9] text-gray-800 font-semibold py-3 px-8 rounded-lg transition mb-6 shadow-md text-xl ${
          isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-[#9FDCC9]"
        }`}
        disabled={isLoading} // 로딩 중일 때 버튼 비활성화
      >
        {isLoading ? "예측 중..." : "번역하기"}
      </button>

      <div className="w-full max-w-md p-6 bg-[#E7ECEF] text-center rounded-lg shadow-lg text-gray-700 text-xl">
        {isLoading ? (
          <p>로딩 중입니다...</p>
        ) : (
          <p>
            {result || (
              <>
                비디오를 선택하거나 업로드하고
                <br />
                번역하기를 클릭하세요.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
