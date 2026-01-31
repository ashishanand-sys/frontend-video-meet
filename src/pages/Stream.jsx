import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";

const socket = io("https://backend-video-meet-1.onrender.com");

export default function Stream() {
  const { streamId } = useParams();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const createPeer = useCallback(() => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("webrtc-ice-candidate", {
          streamId,
          candidate: e.candidate,
        });
      }
    };

    peer.ontrack = (e) => {
      remoteVideoRef.current.srcObject = e.streams[0];
      // Try to play the incoming stream (autoplay may be blocked unless muted)
      try {
        remoteVideoRef.current.play().catch(() => {});
      } catch (err) {
        // ignore play errors
        console.error("Error playing remote video:", err);
      }
    };

    return peer;
  }, [streamId]);

  useEffect(() => {
    socket.emit("join-stream", { streamId, role: "viewer" });

    if (!peerRef.current) {
      peerRef.current = createPeer();
    }

    // Handle incoming WebRTC offer from streamer
    socket.on("webrtc-offer", async (data) => {
      try {
        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(data.offer),
        );
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit("webrtc-answer", { streamId, answer, to: data.from });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    // Handle incoming ICE candidates
    socket.on("webrtc-ice-candidate", (data) => {
      if (data.candidate) {
        peerRef.current
          ?.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch((err) => console.error("Error adding ICE candidate:", err));
      }
    });

    return () => {
      socket.off("webrtc-offer");
      socket.off("webrtc-ice-candidate");
    };
  }, [streamId, createPeer]);

  // Listener for Streamer: Handle incoming Peer Joined and Answers
  useEffect(() => {
    if (isStreaming) {
      const handlePeerJoined = async ({ socketId, role }) => {
        if (role === "viewer") {
          try {
            // Renegotiate / Send Offer to specific user
            const offer = await peerRef.current.createOffer({
              iceRestart: true,
            });
            await peerRef.current.setLocalDescription(offer);
            socket.emit("webrtc-offer", { streamId, offer, to: socketId });
          } catch (err) {
            console.error("Error creating offer for new peer:", err);
          }
        }
      };

      const handleAnswer = async (data) => {
        try {
          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer),
          );
        } catch (err) {
          console.error("Error setting remote description:", err);
        }
      };

      socket.on("peer-joined", handlePeerJoined);
      socket.on("webrtc-answer", handleAnswer);

      return () => {
        socket.off("peer-joined", handlePeerJoined);
        socket.off("webrtc-answer", handleAnswer);
      };
    }
  }, [isStreaming, streamId]);

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      localVideoRef.current.srcObject = stream;

      if (!peerRef.current) {
        peerRef.current = createPeer();
      }

      stream.getTracks().forEach((track) => {
        peerRef.current.addTrack(track, stream);
      });

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);

      socket.emit("join-stream", { streamId, role: "streamer" });
      socket.emit("webrtc-offer", { streamId, offer });

      setIsStreaming(true);
      setStatus("Live");
    } catch (err) {
      setError(err.message);
    }
  };

  const stopStream = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerRef.current?.close();

    localVideoRef.current.srcObject = null;
    remoteVideoRef.current.srcObject = null;

    setIsStreaming(false);
    setStatus("Stopped");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "30px",
        padding: "20px",
        fontFamily: "Arial",
      }}
    >
      {/* LEFT PANEL */}
      <div style={{ flex: 2 }}>
        <h2>Live Stream</h2>

        <div
          style={{
            marginBottom: "20px",
            padding: "15px",
            border: "2px solid #4CAF50",
            borderRadius: "8px",
            backgroundColor: "#f9fff9",
          }}
        >
          <p style={{ fontWeight: "bold" }}>Share this link with viewers:</p>

          <div style={{ display: "flex", gap: "10px" }}>
            <input
              value={window.location.href}
              readOnly
              style={{
                flex: 1,
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <button
              onClick={handleCopy}
              style={{
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Copy
            </button>
          </div>

          {copied && <p style={{ color: "green" }}>✔ Link copied</p>}
        </div>

        <div style={{ marginBottom: "10px" }}>
          <button
            onClick={startStream}
            disabled={isStreaming}
            style={{
              padding: "10px",
              marginRight: "10px",
              background: "#4CAF50",
              color: "white",
              border: "none",
            }}
          >
            Start Streaming
          </button>

          <button
            onClick={stopStream}
            disabled={!isStreaming}
            style={{
              padding: "10px",
              background: "#f44336",
              color: "white",
              border: "none",
            }}
          >
            Stop Streaming
          </button>
        </div>

        <p>
          <strong>Status:</strong> {status}
        </p>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>

      {/* RIGHT PANEL */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", gap: "20px" }}>
          <div>
            <h4>Your Video</h4>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "200px",
                height: "200px",
                background: "#000",
                borderRadius: "8px",
              }}
            />
          </div>

          <div>
            <h4>Remote Video</h4>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "400px",
                height: "400px",
                background: "#000",
                borderRadius: "8px",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
