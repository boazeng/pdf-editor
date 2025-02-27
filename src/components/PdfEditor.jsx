import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Document, Page, pdfjs } from 'react-pdf';
import './PdfEditor.css';

// עדכון הגדרת ה-worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js`;

const PdfEditor = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // העברת כל ה-state hooks לתוך הקומפוננטה
  const [hasUnsavedHeaderChanges, setHasUnsavedHeaderChanges] = useState(false);
  const [hasUnsavedPageNumberChanges, setHasUnsavedPageNumberChanges] = useState(false);
  const [compressionSettings, setCompressionSettings] = useState({
    enabled: false,
    quality: 0.7
  });
  const [fileName, setFileName] = useState('');
  const [previewSettings, setPreviewSettings] = useState({
    currentPage: 1,
    totalPages: 1
  });
  const [numPages, setNumPages] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [headerSettings, setHeaderSettings] = useState({
    text: '',
    fontSize: 16,
    position: 'custom',
    x: 1,
    y: 2,
    show: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [pageNumberSettings, setPageNumberSettings] = useState({
    startFrom: 1,
    fontSize: 12,
    x: 1,
    y: 1,
    show: false
  });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState(null);

  // הגבלת מספר העמודים לתצוגה
  const MAX_PREVIEW_PAGES = 2;

  useEffect(() => {
    const originalFileName = sessionStorage.getItem('originalFileName');
    const file = location.state?.file;
    
    if (!file) {
      navigate('/');
      return;
    }
    
    if (originalFileName) {
      const nameWithoutExtension = originalFileName.replace('.pdf', '');
      setFileName(`${nameWithoutExtension}_1.pdf`);
    }

    // שמירת הקובץ המקורי
    setOriginalFile(file);

    const reader = new FileReader();
    reader.onload = async () => {
      const arrayBuffer = reader.result;
      const bytes = new Uint8Array(arrayBuffer);
      setPdfBytes(bytes);

      const pdfDoc = await PDFDocument.load(bytes);
      const totalPages = pdfDoc.getPageCount();
      setPreviewSettings(prev => ({
        ...prev,
        totalPages: Math.min(totalPages, MAX_PREVIEW_PAGES),
        currentPage: 1
      }));
    };
    reader.onerror = () => {
      alert('שגיאה בטעינת הקובץ');
      navigate('/');
    };
    reader.readAsArrayBuffer(file);
  }, [navigate, location]);

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderSettings(prev => ({
      ...prev,
      [name]: name === 'fontSize' ? parseInt(value) : value
    }));
    setHasUnsavedHeaderChanges(true);
  };

  const handlePageNumberChange = (e) => {
    const { name, value } = e.target;
    setPageNumberSettings(prev => ({
      ...prev,
      [name]: name === 'startFrom' || name === 'fontSize' ? parseInt(value) : parseFloat(value)
    }));
    setHasUnsavedPageNumberChanges(true);
  };

  const handleCompressionChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCompressionSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : parseFloat(value)
    }));
  };

  const handleFileNameChange = (e) => {
    let newName = e.target.value;
    // הוספת סיומת pdf אם לא קיימת
    if (!newName.toLowerCase().endsWith('.pdf')) {
      newName += '.pdf';
    }
    setFileName(newName);
  };

  const applyHeader = () => {
    if (!headerSettings.text) {
      alert('נא להזין טקסט לכותרת');
      return;
    }
    setHeaderSettings(prev => ({
      ...prev,
      show: true
    }));
    setHasUnsavedHeaderChanges(false);
  };

  const applyPageNumbers = () => {
    setPageNumberSettings(prev => ({
      ...prev,
      show: true
    }));
    setHasUnsavedPageNumberChanges(false);
  };

  const getHeaderPosition = (pageWidth, pageHeight) => {
    const margin = 40;
    switch (headerSettings.position) {
      case 'top-left':
        return { x: margin, y: pageHeight - margin };
      case 'top-right':
        return { x: pageWidth - margin, y: pageHeight - margin };
      case 'top-center':
      default:
        return { x: pageWidth / 2, y: pageHeight - margin };
    }
  };

  const saveWithHeader = async () => {
    try {
      setIsLoading(true);
      
      // שלב ראשון: הוספת טקסט עם pdf-lib
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        updateMetadata: false,
        ignoreEncryption: true
      });
      
      // טעינת הפונט רק אם צריך להוסיף טקסט
      let hebrewFont;
      if (headerSettings.show || pageNumberSettings.show) {
        pdfDoc.registerFontkit(fontkit);
        const fontResponse = await fetch('/fonts/DavidLibre-Regular.ttf');
        const fontBytes = await fontResponse.arrayBuffer();
        hebrewFont = await pdfDoc.embedFont(fontBytes, { subset: true });
      }
      
      const pages = pdfDoc.getPages();
      const cmToPoints = 28.35;

      // הוספת טקסט רק אם נבחרו האפשרויות המתאימות
      if (headerSettings.show || pageNumberSettings.show) {
        pages.forEach((page, index) => {
          const { width, height } = page.getSize();
          
          if (headerSettings.show) {
            const fontSize = headerSettings.fontSize;
            const text = headerSettings.text;
            
            let x, y;

            if (headerSettings.position === 'custom') {
              x = headerSettings.x * cmToPoints;
              y = height - (headerSettings.y * cmToPoints);
            } else {
              y = height - 50;
              switch (headerSettings.position) {
                case 'top-left':
                  const leftTextWidth = hebrewFont.widthOfTextAtSize(text, fontSize);
                  x = width - leftTextWidth - 50;
                  break;
                case 'top-right':
                  x = 50;
                  break;
                case 'top-center':
                default:
                  const centerTextWidth = hebrewFont.widthOfTextAtSize(text, fontSize);
                  x = (width - centerTextWidth) / 2;
                  break;
              }
            }

            page.drawText(text, {
              x,
              y,
              size: fontSize,
              font: hebrewFont,
              color: rgb(0, 0, 0)
            });
          }

          if (pageNumberSettings.show) {
            const pageNumber = pageNumberSettings.startFrom + index;
            const numberText = pageNumber.toString();
            
            page.drawText(numberText, {
              x: pageNumberSettings.x * cmToPoints,
              y: height - (pageNumberSettings.y * cmToPoints),
              size: pageNumberSettings.fontSize,
              font: hebrewFont,
              color: rgb(0, 0, 0)
            });
          }
        });
      }

      let finalPdfBytes = await pdfDoc.save();

      // שלב שני: דחיסה (רק אם נבחרה האפשרות)
      if (compressionSettings.enabled) {
        const quality = compressionSettings.quality;
        
        // יצירת PDF חדש
        const compressedPdfDoc = await PDFDocument.create();
        const pages = await pdfDoc.getPages();
        
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const { width, height } = page.getSize();
          
          // יצירת עמוד חדש באותו גודל
          const newPage = compressedPdfDoc.addPage([width, height]);
          
          // העתקת תוכן העמוד
          const form = await compressedPdfDoc.embedPage(page, {
            embedAnnotations: false,
            embedResources: false
          });
          
          // הוספת התוכן לעמוד החדש עם דחיסה
          newPage.drawPage(form, {
            x: 0,
            y: 0,
            width: width * quality,
            height: height * quality,
            opacity: quality
          });
        }
        
        finalPdfBytes = await compressedPdfDoc.save({
          useObjectStreams: true,
          addDefaultPage: false,
          objectsPerTick: 20,
          compress: true
        });
      }

      // הצגת גודל הקובץ לפני ואחרי
      console.log('Original size:', pdfBytes.length);
      console.log('Final size:', finalPdfBytes.length);
      console.log('Compression ratio:', ((1 - finalPdfBytes.length / pdfBytes.length) * 100).toFixed(2) + '%');

      // שמירת הקובץ
      const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const finalFileName = compressionSettings.enabled 
        ? fileName.replace('.pdf', `_compressed_${Math.round(compressionSettings.quality * 100)}.pdf`)
        : fileName;
      
      link.download = finalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (compressionSettings.enabled) {
        const compressionRatio = ((1 - finalPdfBytes.length / pdfBytes.length) * 100).toFixed(2);
        alert(`הקובץ נדחס בהצלחה!\nאחוז דחיסה: ${compressionRatio}%`);
      }

    } catch (error) {
      console.error('שגיאה בשמירת הקובץ:', error);
      alert('אירעה שגיאה בשמירת הקובץ: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // הוספת ניקוי הזיכרון בעת חזרה לעמוד הראשי
  const handleBack = () => {
    sessionStorage.removeItem('pdfFile');
    navigate('/');
  };

  const handlePageChange = (e) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= previewSettings.totalPages) {
      setPreviewSettings(prev => ({
        ...prev,
        currentPage: page
      }));
    }
  };

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setPreviewSettings(prev => ({
      ...prev,
      totalPages: numPages
    }));
  }

  return (
    <div className="pdf-editor-container">
      <div className="top-bar">
        <h1>עריכת PDF</h1>
        <button 
          className="back-button"
          onClick={handleBack}  // שימוש בפונקציה החדשה
        >
          בחר קובץ אחר
        </button>
      </div>
      
      <div className="editor-section">
        <h2>הגדרות כותרת</h2>
        <div className="header-settings">
          <div className="input-row">
            <div className="setting-group">
              <label htmlFor="header-text">טקסט הכותרת</label>
              <input
                type="text"
                id="header-text"
                name="text"
                value={headerSettings.text}
                onChange={handleHeaderChange}
                placeholder="הכנס טקסט לכותרת"
                className="text-input"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="font-size">גודל פונט</label>
              <input
                type="number"
                id="font-size"
                name="fontSize"
                value={headerSettings.fontSize}
                onChange={handleHeaderChange}
                min="8"
                max="72"
                className="number-input"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="position">מיקום הכותרת</label>
              <select
                id="position"
                name="position"
                value={headerSettings.position}
                onChange={handleHeaderChange}
                className="select-input"
              >
                <option value="custom">מיקום מותאם אישית</option>
                <option value="top-right">ימין למעלה</option>
                <option value="top-center">מרכז למעלה</option>
                <option value="top-left">שמאל למעלה</option>
              </select>
            </div>

            {headerSettings.position === 'custom' && (
              <>
                <div className="setting-group">
                  <label htmlFor="x-position">מרחק מצד שמאל</label>
                  <input
                    type="number"
                    id="x-position"
                    name="x"
                    value={headerSettings.x}
                    onChange={handleHeaderChange}
                    min="0"
                    max="29.7"
                    step="0.1"
                    className="number-input"
                  />
                </div>

                <div className="setting-group">
                  <label htmlFor="y-position">מרחק מלמעלה</label>
                  <input
                    type="number"
                    id="y-position"
                    name="y"
                    value={headerSettings.y}
                    onChange={handleHeaderChange}
                    min="0"
                    max="21"
                    step="0.1"
                    className="number-input"
                  />
                </div>
              </>
            )}

            <div className="setting-group">
              <label>&nbsp;</label>
              <button 
                onClick={applyHeader}
                className={`apply-button ${!hasUnsavedHeaderChanges && headerSettings.show ? 'applied' : ''}`}
                disabled={!headerSettings.text}
              >
                החל כותרת
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="editor-section">
        <h2>הגדרות מספרי עמודים</h2>
        <div className="header-settings">
          <div className="input-row">
            <div className="setting-group">
              <label htmlFor="start-from">התחל ממספר</label>
              <input
                type="number"
                id="start-from"
                name="startFrom"
                value={pageNumberSettings.startFrom}
                onChange={handlePageNumberChange}
                min="1"
                className="number-input"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="page-number-font-size">גודל פונט</label>
              <input
                type="number"
                id="page-number-font-size"
                name="fontSize"
                value={pageNumberSettings.fontSize}
                onChange={handlePageNumberChange}
                min="8"
                max="72"
                className="number-input"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="page-number-x">מרחק מצד שמאל</label>
              <input
                type="number"
                id="page-number-x"
                name="x"
                value={pageNumberSettings.x}
                onChange={handlePageNumberChange}
                min="0"
                max="29.7"
                step="0.1"
                className="number-input"
              />
            </div>

            <div className="setting-group">
              <label htmlFor="page-number-y">מרחק מלמעלה</label>
              <input
                type="number"
                id="page-number-y"
                name="y"
                value={pageNumberSettings.y}
                onChange={handlePageNumberChange}
                min="0"
                max="21"
                step="0.1"
                className="number-input"
              />
            </div>

            <div className="setting-group">
              <label>&nbsp;</label>
              <button 
                onClick={applyPageNumbers}
                className={`apply-button ${!hasUnsavedPageNumberChanges && pageNumberSettings.show ? 'applied' : ''}`}
                disabled={pageNumberSettings.startFrom < 1}
              >
                החל מספרי עמודים
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="editor-section">
        <h2>הגדרות דחיסה</h2>
        <div className="header-settings">
          <div className="input-row">
            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="enabled"
                  checked={compressionSettings.enabled}
                  onChange={handleCompressionChange}
                  className="checkbox-input"
                />
                הפעל דחיסת קובץ
              </label>
            </div>

            {compressionSettings.enabled && (
              <div className="setting-group">
                <label htmlFor="compression-quality">איכות הדחיסה</label>
                <div className="quality-input-container">
                  <input
                    type="range"
                    id="compression-quality"
                    name="quality"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={compressionSettings.quality}
                    onChange={handleCompressionChange}
                    className="quality-slider"
                  />
                  <span className="quality-value">{Math.round(compressionSettings.quality * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="editor-section">
        <h2>הגדרות שמירה</h2>
        <div className="header-settings">
          <div className="input-row">
            <div className="setting-group">
              <label htmlFor="file-name">שם הקובץ</label>
              <input
                type="text"
                id="file-name"
                value={fileName}
                onChange={handleFileNameChange}
                className="text-input"
                placeholder="הכנס שם לקובץ"
              />
            </div>

            <div className="setting-group">
              <label>&nbsp;</label>
              <button 
                className="save-button"
                onClick={saveWithHeader}
                disabled={(!headerSettings.show && !pageNumberSettings.show && !compressionSettings.enabled) || isLoading || !fileName}
              >
                {isLoading ? 'שומר...' : 'שמור PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="editor-section">
        <h2>תצוגה מקדימה (2 עמודים ראשונים)</h2>
        <div className="preview-controls">
          <div className="setting-group">
            <label htmlFor="current-page">עמוד:</label>
            <input
              type="number"
              id="current-page"
              value={previewSettings.currentPage}
              onChange={handlePageChange}
              min="1"
              max={previewSettings.totalPages}
              className="number-input"
            />
            <span className="page-count">מתוך {previewSettings.totalPages}</span>
          </div>
        </div>
        <div className="pdf-preview">
          {originalFile && (
            <Document
              file={originalFile}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="loading-message">טוען PDF...</div>}
              error={<div className="error-message">שגיאה בטעינת הקובץ. נסה שוב.</div>}
              noData={<div>אנא בחר קובץ PDF</div>}
            >
              <Page
                pageNumber={previewSettings.currentPage}
                width={800}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={<div className="loading-message">טוען עמוד...</div>}
                error={<div className="error-message">שגיאה בטעינת העמוד</div>}
              />
            </Document>
          )}
          <div className="preview-note">
            * מוצגים רק 2 העמודים הראשונים לתצוגה מקדימה
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfEditor; 