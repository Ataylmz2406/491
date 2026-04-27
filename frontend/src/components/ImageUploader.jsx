import React, { useState } from 'react';
import { Camera, ImageIcon, Upload, X, ZoomIn } from 'lucide-react';

export default function ImageUploader({
    language = 'en',
    userType = null,
    dermFiles, dermPreviews, clinFile, clinPreview, handleFileChange, clearFile,
    showClinical = true
}) {
    const [zoomedImage, setZoomedImage] = useState(null);
    const [isDraggingDerm, setIsDraggingDerm] = useState(false);
    const [isDraggingClin, setIsDraggingClin] = useState(false);

    const translations = {
      en: {
        dermoscopicHeader: userType === 'personal' ? 'Close-up Photo' : 'Dermoscopic',
        clinicalHeader: 'Clinical',
        required: 'Required',
        optional: 'Optional',
        userMayUpload: 'User may upload up to four photos',
        uploadDermoscopy: userType === 'personal' ? 'Upload Close-up' : 'Upload Dermoscopy',
        uploadDermoscopyDesc: 'High-resolution close-up (JPG, PNG) - Up to 4 photos',
        uploadMore: (count) => `Upload more (${count}/4)`,
        uploadClinicalView: 'Upload Clinical View',
        clinicalDesc: 'Macro/Regional photo',
        invalid: 'Not valid',
        chooseImages: 'Choose images',
        seeExampleImages: 'see example images',
        orDragImagesHere: 'or drag images here',
        orDragImageHere: 'or drag an image here'
      },
      tr: {
        dermoscopicHeader: userType === 'personal' ? 'Yakın Çekim Fotoğraf' : 'Dermatoskopik',
        clinicalHeader: 'Klinik',
        required: 'Zorunlu',
        optional: 'Opsiyonel',
        userMayUpload: 'Kullanıcı en fazla dört fotoğraf yükleyebilir',
        uploadDermoscopy: userType === 'personal' ? 'Yakın Çekim Yükle' : 'Dermatoskopi Yükle',
        uploadDermoscopyDesc: 'Yüksek çözünürlüklü yakın çekim (JPG, PNG) - En fazla 4 fotoğraf',
        uploadMore: (count) => `Daha fazla yükle (${count}/4)`,
        uploadClinicalView: 'Klinik Görünüm Yükle',
        clinicalDesc: 'Makro/Bölgesel fotoğraf',
        invalid: 'Geçersiz',
        chooseImages: 'Görüntüleri seç',
        seeExampleImages: 'örnek resimleri göster',
        orDragImagesHere: 'veya resimleri buraya sürükleyin',
        orDragImageHere: 'veya bir resmi buraya sürükleyin'
      }
    };

    const t = translations[language] || translations.en;

    const handleDragOver = (e, type) => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'derm') setIsDraggingDerm(true);
        if (type === 'clin') setIsDraggingClin(true);
    };

    const handleDragLeave = (e, type) => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'derm') setIsDraggingDerm(false);
        if (type === 'clin') setIsDraggingClin(false);
    };

    const handleDrop = (e, type) => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'derm') setIsDraggingDerm(false);
        if (type === 'clin') setIsDraggingClin(false);

        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;

        // Simulate file input change
        const event = {
            target: { files: files }
        };
        handleFileChange(event, type);
    };

    const getGridColsClass = () => {
        if (dermPreviews.length === 1) return 'grid-cols-1';
        if (dermPreviews.length === 2) return 'grid-cols-2';
        if (dermPreviews.length === 3) return 'grid-cols-3';
        return 'grid-cols-2';
    };

    return (
        <div className="flex flex-col gap-6 mb-6">
            {/* Zoom Modal */}
            {zoomedImage && (
                <div 
                    className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
                    onClick={() => setZoomedImage(null)}
                >
                    <div 
                        className="relative w-full max-w-5xl max-h-[90vh] bg-black rounded-lg overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img 
                            src={zoomedImage} 
                            className="w-full h-full object-contain" 
                            alt="Zoomed view"
                        />
                        <button
                            onClick={() => setZoomedImage(null)}
                            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-lg transition-colors z-10"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>
                    </div>
                </div>
            )}

            {/* Dermoscopic */}
            <div 
                className={`relative p-6 transition-all duration-300 bg-white border-2 border-dashed rounded-xl ${isDraggingDerm ? 'border-brand-500 bg-brand-50 shadow-lg scale-[1.01]' : ''} ${dermFiles.length === 0 ? 'border-brand-300 hover:border-brand-500 hover:bg-brand-50/50 hover:shadow-lg hover:scale-[1.01]' : 'border-brand-600 bg-brand-50/20 shadow-md'}`}
                onDragOver={(e) => handleDragOver(e, 'derm')}
                onDragLeave={(e) => handleDragLeave(e, 'derm')}
                onDrop={(e) => handleDrop(e, 'dermoscopic')}
            >
                <div className="flex justify-between mb-4">
                    <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                        <h3 className="flex items-center gap-2 font-semibold text-gray-700 text-lg">
                            <Camera className="w-8 h-8 text-brand-600" /> {t.dermoscopicHeader}
                            <span className="text-[13px] font-bold text-brand-700 bg-brand-100 px-3 py-1 rounded-full uppercase">{t.required}</span>
                        </h3>
                    </div>
                    <div className="relative inline-flex flex-col items-start group">
                        <span className="text-sm text-brand-600 font-medium underline underline-offset-2 cursor-pointer">
                            {t.seeExampleImages}
                        </span>
                        <div className="invisible absolute left-0 top-full z-50 mt-3 w-[28rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                            <img
                                src="/sample_dermoscopic.webp"
                                alt="Dermoscopic example images"
                                className="h-80 w-full rounded-xl object-cover border border-slate-200 transition-transform duration-200 cursor-pointer hover:scale-110 active:scale-110"
                                onClick={() => setZoomedImage('/sample_dermoscopic.webp')}
                            />
                        </div>
                    </div>
                </div>
                {dermFiles.length > 0 && <button onClick={() => clearFile('dermoscopic')}><X className="w-8 h-8 text-gray-400 hover:text-red-500" /></button>}
                </div>

                {dermPreviews.length === 0 ? (
                    <label className="flex flex-col items-center justify-center h-56 cursor-pointer group">
                        <div className="p-4 mb-3 bg-brand-100 rounded-full group-hover:bg-brand-200 transition-colors group-hover:scale-110 duration-300"><Upload className="w-14 h-14 text-brand-600" /></div>
                        <span className="text-lg font-medium text-brand-700 group-hover:text-brand-800 transition-colors">{t.uploadDermoscopy}</span>
                        <span className="text-base text-gray-400 mt-1">{t.uploadDermoscopyDesc}</span>
                        <span className="text-sm text-brand-600 font-medium mt-3">{t.orDragImagesHere}</span>
                        <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            multiple
                            onChange={(e) => handleFileChange(e, 'dermoscopic')}
                            disabled={dermFiles.length >= 4}
                        />
                    </label>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className={`grid ${getGridColsClass()} gap-3`}>
                            {dermPreviews.map((preview, index) => (
                                <div 
                                    key={index}
                                    className="relative group overflow-hidden bg-black rounded-lg"
                                >
                                    <img 
                                        src={preview} 
                                        className="object-contain w-full h-40 hover:scale-105 transition-transform duration-300 cursor-pointer"
                                        alt={`Dermoscopic preview ${index + 1}`}
                                        onClick={() => setZoomedImage(preview)}
                                    />
                                    <div 
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                        onClick={() => setZoomedImage(preview)}
                                    >
                                        <ZoomIn className="w-8 h-8 text-white" />
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            clearFile('dermoscopic', index);
                                        }}
                                        className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    >
                                        <X className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        
                        {/* Upload more button */}
                        {dermFiles.length < 4 && (
                            <label className="flex flex-col items-center justify-center h-28 cursor-pointer rounded-lg border-2 border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50/30 transition-all group"
                                onDragOver={(e) => handleDragOver(e, 'derm')}
                                onDragLeave={(e) => handleDragLeave(e, 'derm')}
                                onDrop={(e) => handleDrop(e, 'dermoscopic')}
                            >
                                <div className="p-2 bg-brand-100 rounded-full group-hover:bg-brand-200 transition-colors">
                                    <Upload className="w-6 h-6 text-brand-600" />
                                </div>
                                <span className="text-sm text-brand-700 group-hover:text-brand-800 transition-colors font-medium mt-1">
                                    {t.uploadMore(dermFiles.length)}
                                </span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => handleFileChange(e, 'dermoscopic')}
                                    disabled={dermFiles.length >= 4}
                                />
                            </label>
                        )}
                    </div>
                )}
            </div>

            {/* Clinical */}
            {showClinical && (
              <div 
                className={`relative p-6 transition-all duration-300 bg-white border-2 border-dashed rounded-xl ${isDraggingClin ? 'border-indigo-500 bg-indigo-50 shadow-lg scale-[1.01]' : ''} ${!clinFile ? 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30 hover:shadow-lg hover:scale-[1.01]' : 'border-indigo-600 bg-indigo-50/20 shadow-md'}`}
                onDragOver={(e) => handleDragOver(e, 'clin')}
                onDragLeave={(e) => handleDragLeave(e, 'clin')}
                onDrop={(e) => handleDrop(e, 'clinical')}
              >
                <div className="flex justify-between mb-4">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-700 text-lg">
                        <ImageIcon className="w-8 h-8 text-indigo-600" /> {t.clinicalHeader}
                        <span className="text-[13px] font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full uppercase">{t.optional}</span>
                    </h3>
                    {clinFile && <button onClick={() => clearFile('clinical')}><X className="w-8 h-8 text-gray-400 hover:text-red-500" /></button>}
                </div>

                {!clinPreview ? (
                    <label className="flex flex-col items-center justify-center h-56 cursor-pointer group">
                        <div className="p-4 mb-3 bg-gray-100 rounded-full group-hover:bg-indigo-100 transition-colors group-hover:scale-110 duration-300"><Upload className="w-14 h-14 text-gray-500 group-hover:text-indigo-600 transition-colors" /></div>
                        <span className="text-lg font-medium text-gray-600 group-hover:text-indigo-700 transition-colors">{t.uploadClinicalView}</span>
                        <span className="text-base text-gray-400 mt-1">{t.clinicalDesc}</span>
                        <span className="text-sm text-indigo-600 font-medium mt-3">{t.orDragImageHere}</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'clinical')} />
                    </label>
                ) : (
                    <div className="relative h-44 w-44 mx-auto overflow-hidden bg-black rounded-lg group">
                        <img src={clinPreview} className="object-contain w-full h-full" alt="Clinical preview" />
                    </div>
                )}
              </div>
            )}
        </div>
    );
}
