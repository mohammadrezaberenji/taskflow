
import { useEffect, useState } from "react";

function App() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    fetch("/api/tasks")
      .then(res => res.json())
      .then(data => setTasks(data));
  }, []);

  return (
    <div>
      <h1>Task Manager</h1>
      {tasks.map(task => (
        <div key={task.id}>
          {task.title} - {task.status}
        </div>
      ))}
    </div>
  );
}

export default App;