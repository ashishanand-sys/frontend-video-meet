import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";

const socket = io("https://backend-video-meet-1.onrender.com");

// A simple Video component to display a stream
const VideoPlayer = ({ stream, muted = false, label = "User" }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)", // Mirror effect
          borderRadius: "8px",
          backgroundColor: "#202124",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          color: "white",
          background: "rgba(0,0,0,0.5)",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "12px",
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default function Meeting() {
  const { streamId: roomId } = useParams();
  const navigate = useNavigate();

  // State
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState([]); // Array of { socketId, stream }
  const [copied, setCopied] = useState(false);

  // Controls
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  // Refs
  const peersRef = useRef({}); // { socketId: RTCPeerConnection }
  const localStreamRef = useRef(null);
  const hasJoinedRef = useRef(false);

  // Initialize Media and Socket Headers
  useEffect(() => {
    const startCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;

        if (!hasJoinedRef.current) {
          console.log("Joining room:", roomId);
          socket.emit("join-room", roomId);
          hasJoinedRef.current = true;
        }
      } catch (err) {
        console.error("Failed to get local stream", err);
        alert("Could not access camera/microphone. Please allow permissions.");
      }
    };

    startCall();

    // SOCKET EVENTS
  // --- Helper Functions ---

  function createPeerConnection(targetSocketId) {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", {
          target: targetSocketId,
          candidate: e.candidate,
          caller: socket.id,
        });
      }
    };

    peer.ontrack = (e) => {
      console.log("Received Track from:", targetSocketId);
      setPeers((prev) => {
        if (!prev.find((p) => p.socketId === targetSocketId)) {
          return [...prev, { socketId: targetSocketId, stream: e.streams[0] }];
        }
        return prev;
      });
    };

    peersRef.current[targetSocketId] = peer;
    return peer;
  }

  // Initiated by existing users when they see a new user
  function connectToNewUser(targetSocketId, stream) {
    const peer = createPeerConnection(targetSocketId);

    if (stream) {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    }

    peer
      .createOffer()
      .then((offer) => {
        return peer.setLocalDescription(offer);
      })
      .then(() => {
        socket.emit("offer", {
          target: targetSocketId,
          caller: socket.id,
          offer: peer.localDescription,
        });
      })
      .catch((e) => console.error("Error connecting to new user:", e));
  }

  // Initiated by the new user when they receive an offer
  async function handleReceiveOffer(offer, callerSocketId, stream) {
    const peer = createPeerConnection(callerSocketId);

    if (stream) {
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    }

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("answer", {
      target: callerSocketId,
      caller: socket.id,
      answer,
    });
  }

    // 1. Existing participants see a New User join
    socket.on("user-connected", (userSocketId) => {
      console.log("User Connected:", userSocketId);
      connectToNewUser(userSocketId, localStreamRef.current);
    });

    // 2. New User receives an Offer from an existing participant
    socket.on("offer", async (payload) => {
      console.log("Received Offer from:", payload.caller);
      await handleReceiveOffer(
        payload.offer,
        payload.caller,
        localStreamRef.current,
      );
    });

    // 3. Sender receives Answer from the New User
    socket.on("answer", (payload) => {
      console.log("Received Answer from:", payload.caller);
      const peer = peersRef.current[payload.caller];
      if (peer) {
        peer
          .setRemoteDescription(new RTCSessionDescription(payload.answer))
          .catch((e) => console.error(e));
      }
    });

    // 4. Handle ICE Candidates
    socket.on("ice-candidate", (payload) => {
      const peer = peersRef.current[payload.caller];
      if (peer && payload.candidate) {
        peer
          .addIceCandidate(new RTCIceCandidate(payload.candidate))
          .catch((e) => console.error(e));
      }
    });

    // 5. User Disconnected
    socket.on("user-disconnected", (userSocketId) => {
      if (peersRef.current[userSocketId]) {
        peersRef.current[userSocketId].close();
        delete peersRef.current[userSocketId];
      }
      setPeers((prev) => prev.filter((p) => p.socketId !== userSocketId));
    });

    return () => {
      socket.off("user-connected");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-disconnected");
      // We generally don't stop the stream here to avoid flickering logic in dev mode, but strictly we should.
    };
  }, [roomId]);


  // Toggle Controls
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamOn(videoTrack.enabled);
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveCall = () => {
    // Disconnect socket and local stream
    socket.disconnect();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    navigate("/");
    window.location.reload(); // Quick way to ensure clean state
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#202124",
        color: "white",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          padding: "15px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #3c4043",
        }}
      >
        <h3>Meeting Room</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span>{roomId}</span>
          <button onClick={handleCopy} style={styles.copyBtn}>
            {copied ? "Copied!" : "Copy Joining Info"}
          </button>
        </div>
      </div>

      {/* VIDEO GRID */}
      <div
        style={{
          flex: 1,
          padding: "20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
          overflowY: "auto",
        }}
      >
        {/* Local Video */}
        {localStream && (
          <div style={{ aspectRatio: "16/9", minHeight: "200px" }}>
            <VideoPlayer stream={localStream} muted={true} label="You" />
          </div>
        )}

        {/* Remote Peers */}
        {peers.map((peerObj) => (
          <div
            key={peerObj.socketId}
            style={{ aspectRatio: "16/9", minHeight: "200px" }}
          >
            <VideoPlayer stream={peerObj.stream} label="Participant" />
          </div>
        ))}
      </div>

      {/* FOOTER CONTROLS */}
      <div
        style={{
          padding: "20px",
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          borderTop: "1px solid #3c4043",
          background: "#202124",
        }}
      >
        <button
          onClick={toggleMic}
          style={{
            ...styles.controlBtn,
            background: isMicOn ? "#3c4043" : "#ea4335",
          }}
        >
          {isMicOn ? "🎙️ Mic On" : "mic_off Mic Off"}
        </button>
        <button
          onClick={toggleCam}
          style={{
            ...styles.controlBtn,
            background: isCamOn ? "#3c4043" : "#ea4335",
          }}
        >
          {isCamOn ? "📹 Cam On" : "videocam_off Cam Off"}
        </button>
        <button
          onClick={leaveCall}
          style={{
            ...styles.controlBtn,
            background: "#ea4335",
            minWidth: "120px",
          }}
        >
          📞 End Call
        </button>
      </div>
    </div>
  );
}

const styles = {
  copyBtn: {
    background: "transparent",
    color: "#8ab4f8",
    border: "1px solid #5f6368",
    borderRadius: "4px",
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: "14px",
  },
  controlBtn: {
    border: "none",
    borderRadius: "40px",
    padding: "12px 24px",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
};
