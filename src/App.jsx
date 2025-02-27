import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FileUpload from './components/FileUpload';
import PdfEditor from './components/PdfEditor';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<FileUpload />} />
          <Route path="/editor" element={<PdfEditor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 