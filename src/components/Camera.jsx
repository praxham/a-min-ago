import { useState, useRef, useEffect } from 'react';

const Camera = () => {
  const [bufferTimer, setBufferTimer] = useState(0);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        // First try to get the back camera
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: true
        });
        
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        startBackgroundRecording(mediaStream);
      } catch (err) {
        console.error("Back camera error:", err);
        try {
          // Fallback to any available camera
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          setStream(fallbackStream);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
          startBackgroundRecording(fallbackStream);
        } catch (fallbackErr) {
          console.error("Camera access failed:", fallbackErr);
        }
      }
    };

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const startBackgroundRecording = (mediaStream) => {
    // Clear any existing recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Initialize new recorder
    mediaRecorderRef.current = new MediaRecorder(mediaStream, {
      mimeType: 'video/webm;codecs=vp8,opus'
    });
    
    chunksRef.current = [];
    startTimeRef.current = Date.now();

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
        
        // Keep only the last minute of chunks
        const totalDuration = Date.now() - startTimeRef.current;
        if (totalDuration > 60000) {
          startTimeRef.current = Date.now();
          const newChunks = [];
          chunksRef.current = newChunks;
          
          // Restart recording
          if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.start(1000);
          }
        }
      }
    };

    // Start recording
    mediaRecorderRef.current.start(1000);

    // Update buffer timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setBufferTimer(Math.min(elapsed, 60));
    }, 1000);
  };

  const saveRecording = () => {
    if (mediaRecorderRef.current && chunksRef.current.length > 0) {
      // Create a copy of the current chunks
      const chunksToSave = [...chunksRef.current];
      
      // Create and download the blob
      const blob = new Blob(chunksToSave, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style = 'display: none';
      a.href = url;
      a.download = `recording-${new Date().getTime()}.webm`;
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Reset recording
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      // Start new recording after a short delay
      setTimeout(() => {
        chunksRef.current = [];
        startTimeRef.current = Date.now();
        mediaRecorderRef.current.start(1000);
      }, 100);
    }
  };

  return (
    <div className="h-screen w-screen lg:max-w-[400px] lg:mx-auto flex flex-col bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
      />

      <div className="fixed bottom-0 right-0 w-screen lg:max-w-[400px] flex flex-row items-center justify-between bg-black text-white p-8">
        <div className="text-4xl font-semibold rotate-90">
          {bufferTimer}s
        </div>
        <button
          onClick={saveRecording}
          className="w-[100px] h-[100px] rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
        />
        <div className="w-16 h-16" />
      </div>
    </div>
  );
};

export default Camera;