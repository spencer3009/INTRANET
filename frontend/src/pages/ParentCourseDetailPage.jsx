import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import StudentCourseDetailPage from "./StudentCourseDetailPage";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentCourseDetailPage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const init = async () => {
      try {
        const res = await axios.get(`${API}/api/parent/me`, { headers });
        const childrenList = res.data.children || [];
        setChildren(childrenList);
        if (childrenList.length > 0) {
          const savedId = localStorage.getItem("selected_child_id");
          const child = childrenList.find((c) => c.id === savedId) || childrenList[0];
          setSelectedChild(child);
          localStorage.setItem("selected_child_id", child.id);
        }
      } catch (err) {
        console.error("Error loading parent data:", err);
      }
    };
    init();
  }, [token]);

  const handleChildChange = (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    localStorage.setItem("selected_child_id", newChild.id);
  };

  return (
    <StudentCourseDetailPage
      user={user}
      token={token}
      onLogout={onLogout}
      isParent={true}
      parentChildren={children}
      selectedChild={selectedChild}
      onSelectChild={handleChildChange}
    />
  );
}
