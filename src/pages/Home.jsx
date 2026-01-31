import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const createStream = () => {
    const streamId = crypto.randomUUID();
    navigate(`/stream/${streamId}?role=host`);
  };

  return (
    <div style={{ padding: "40px" }}>
      <h1>Live Video Streaming</h1>

      <button
        onClick={createStream}
        style={{
          padding: "15px 30px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "6px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        Create Live Stream
      </button>
    </div>
  );
}
