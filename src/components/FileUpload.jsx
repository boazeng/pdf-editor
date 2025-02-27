import React, { useState } from 'react';
import './FileUpload.css';
import { useNavigate } from 'react-router-dom';

const FileUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError('');
    } else {
      setSelectedFile(null);
      setError('אנא בחר קובץ PDF בלבד');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    
    if (!selectedFile) {
      setError('אנא בחר קובץ');
      return;
    }

    sessionStorage.setItem('originalFileName', selectedFile.name);
    
    navigate('/editor', { 
      state: { 
        file: selectedFile 
      }
    });
  };

  return (
    <div className="file-upload-container">
      <h1>העלאת קובץ PDF</h1>
      <form onSubmit={handleSubmit}>
        <div className="upload-area">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            id="file-input"
          />
          <label htmlFor="file-input">
            {selectedFile ? selectedFile.name : 'בחר קובץ PDF'}
          </label>
        </div>
        
        {error && <p className="error-message">{error}</p>}
        
        <button 
          type="submit" 
          disabled={!selectedFile}
          className="upload-button"
        >
          העלה קובץ
        </button>
      </form>
    </div>
  );
};

export default FileUpload; 