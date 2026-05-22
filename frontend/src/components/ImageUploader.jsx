import React, { useState } from 'react';
import { AlertCircle, Camera, CheckCircle, ChevronDown, ChevronUp, Crop, FolderOpen, ImageIcon, RotateCw, Upload, X, ZoomIn } from 'lucide-react';

export default function ImageUploader({
    language = 'en',
    userType = null,
    dermFiles, dermPreviews, clinFile, clinPreview, handleFileChange, clearFile,
    editDermoscopicImage,
    imageQualityNotes = [],
    showClinical = true
}) {
    const [zoomedImage, setZoomedImage] = useState(null);
    const [isDraggingDerm, setIsDraggingDerm] = useState(false);
    const [isDraggingClin, setIsDraggingClin] = useState(false);
    const [guideExpanded, setGuideExpanded] = useState(true);

    const translations = {
        en: {
            dermoscopicHeader: userType === 'personal' ? 'Close-up Photo' : 'Dermoscopic',
            clinicalHeader: 'Clinical',
            required: 'Required',
            optional: 'Optional',
            userMayUpload: 'User may upload up to four photos',
            uploadDermoscopy: userType === 'personal' ? 'Upload Close-up' : 'Upload Dermoscopy',
            uploadDermoscopyDesc: 'High-resolution close-up (JPG, PNG, WebP, HEIC/HEIF) - Up to 4 photos, 8 MB each',
            uploadMore: (count) => `Upload more (${count}/4)`,
            uploadClinicalView: 'Upload Clinical View',
            clinicalDesc: 'Macro/Regional photo',
            takePhoto: 'Take Photo',
            chooseFromGallery: 'Choose from Gallery',
            chooseFromFiles: 'Choose from Files',
            mobileCaptureHint: 'Use the rear camera or pick an existing image.',
            invalid: 'Not valid',
            chooseImages: 'Choose images',
            seeExampleImages: '(see example images)',
            guideTitle: 'Photo guide for accurate analysis',
            guideSubtitle: 'Use three views when possible. Best input is dermoscopic.',
            guideSummary: 'Macro close-up: 10-15 cm, 2x optical zoom, lesion centered.',
            showGuide: 'Show guide',
            hideGuide: 'Hide guide',
            contextShot: 'Context',
            contextDesc: 'Show body location and nearby landmarks.',
            contextDistance: '50-100 cm',
            midShot: 'Mid-range',
            midDesc: 'Show lesion with surrounding healthy skin.',
            midDistance: '20-40 cm',
            macroShot: 'Macro (Close-Up)',
            macroDesc: 'Fine detail: color, texture, and border traits.',
            macroDistance: '10-15 cm, use 2x optical zoom',
            macroFrame: 'Lesion centered with a small margin of healthy skin.',
            qualityTitle: 'Image quality feedback',
            equityNote: 'Skin-tone safety: AI accuracy can be lower on underrepresented darker skin tones. Use review-required results conservatively and consult a clinician for changing, crusted, bleeding, or non-healing lesions.',
            quickTips: 'Rear camera, tap-to-focus, indirect light, no filters, no digital zoom, no harsh flash.',
            orDragImagesHere: 'or drag images here',
            orDragImageHere: 'or drag an image here',
            rotateImage: 'Rotate image',
            cropSquare: 'Center crop'
        },
        tr: {
            dermoscopicHeader: userType === 'personal' ? 'Yakın Çekim Fotoğraf' : 'Dermatoskopik',
            clinicalHeader: 'Klinik',
            required: 'Zorunlu',
            optional: 'Opsiyonel',
            userMayUpload: 'Kullanıcı en fazla dört fotoğraf yükleyebilir',
            uploadDermoscopy: userType === 'personal' ? 'Yakın Çekim Yükle' : 'Dermatoskopi Yükle',
            uploadDermoscopyDesc: 'Yüksek çözünürlüklü yakın çekim (JPG, PNG, WebP, HEIC/HEIF) - En fazla 4 fotoğraf, her biri 8 MB',
            uploadMore: (count) => `Daha fazla yükle (${count}/4)`,
            uploadClinicalView: 'Klinik Görünüm Yükle',
            clinicalDesc: 'Makro/Bölgesel fotoğraf',
            takePhoto: 'Fotoğraf Çek',
            chooseFromGallery: 'Galeriden Seç',
            chooseFromFiles: 'Dosyalardan Seç',
            mobileCaptureHint: 'Arka kamerayı kullanın veya mevcut bir görüntü seçin.',
            invalid: 'Geçersiz',
            chooseImages: 'Görüntüleri seç',
            seeExampleImages: '(örnek resimleri göster)',
            guideTitle: 'Doğru analiz için fotoğraf kılavuzu',
            guideSubtitle: 'Mümkünse üç görünüm kullanın. En iyi giriş dermatoskopiktir.',
            guideSummary: 'Makro yakın çekim: 10-15 cm, 2x optik zoom, lezyon merkezde.',
            showGuide: 'Kılavuzu göster',
            hideGuide: 'Kılavuzu gizle',
            contextShot: 'Bağlam',
            contextDesc: 'Vücut konumunu ve yakın işaretleri gösterin.',
            contextDistance: '50-100 cm',
            midShot: 'Orta mesafe',
            midDesc: 'Lezyonu çevre sağlam deri ile gösterin.',
            midDistance: '20-40 cm',
            macroShot: 'Makro (Yakın Çekim)',
            macroDesc: 'İnce detay: renk, doku ve sınır özellikleri.',
            macroDistance: '10-15 cm, 2x optik zoom kullanın',
            macroFrame: 'Lezyon merkezde, çevrede az miktarda sağlam deri görünür.',
            qualityTitle: 'Görüntü kalitesi geri bildirimi',
            equityNote: 'Cilt tonu güvenliği: AI doğruluğu yeterince temsil edilmeyen koyu cilt tonlarında daha düşük olabilir. İnceleme gerektiren sonuçları dikkatle ele alın ve değişen, kabuklu, kanayan veya iyileşmeyen lezyonlarda klinisyene danışın.',
            quickTips: 'Arka kamera, dokun-odakla, dolaylı ışık, filtresiz, dijital zoom yok, sert flaş yok.',
            orDragImagesHere: 'veya resimleri buraya sürükleyin',
            orDragImageHere: 'veya bir resmi buraya sürükleyin',
            rotateImage: 'Görüntüyü döndür',
            cropSquare: 'Ortadan kırp'
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
        if (type === 'derm' || type === 'dermoscopic') setIsDraggingDerm(false);
        if (type === 'clin' || type === 'clinical') setIsDraggingClin(false);

        const files = Array.from(e.dataTransfer.files);
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

    const captureGuideSteps = [
        { title: t.contextShot, distance: t.contextDistance, description: t.contextDesc, frame: 'wide', icon: ImageIcon },
        { title: t.midShot, distance: t.midDistance, description: t.midDesc, frame: 'mid', icon: Camera },
        { title: t.macroShot, distance: t.macroDistance, description: t.macroDesc, frame: 'macro', icon: ZoomIn },
    ];

    const renderCaptureGuide = () => {
        return (
            <div className="mb-4 rounded-lg border border-brand-100 bg-white/90 shadow-sm">
                <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{t.guideTitle}</p>
                            <p className="text-xs text-slate-500">{guideExpanded ? t.guideSubtitle : t.guideSummary}</p>
                        </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setGuideExpanded((value) => !value)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                        >
                            {guideExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {guideExpanded ? t.hideGuide : t.showGuide}
                        </button>
                    </div>
                </div>

                <div className={`overflow-hidden border-t border-slate-100 transition-all duration-300 ease-in-out ${guideExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="grid gap-2 p-3 md:grid-cols-3">
                        {captureGuideSteps.map((step) => {
                            const Icon = step.icon;
                            return (
                                <div key={step.title} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4 text-brand-700" />
                                        <p className="text-xs font-bold text-slate-800">{step.title}</p>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold text-brand-700">{step.distance}</p>
                                    <p className="mt-0.5 text-xs text-slate-600">{step.description}</p>
                                    {step.frame === 'macro' && (
                                        <p className="mt-0.5 text-xs text-slate-500">{t.macroFrame}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="space-y-2 px-3 pb-3">
                        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{t.quickTips}</p>
                        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{t.equityNote}</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderQualityNotes = () => {
        if (imageQualityNotes.length === 0) return null;

        return (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-brand-700" />
                    <p className="text-sm font-bold text-slate-800">{t.qualityTitle}</p>
                </div>
                <div className="space-y-2">
                    {imageQualityNotes.slice(-4).map((note, index) => {
                        const toneClasses = note.severity === 'ok'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : note.severity === 'block'
                                ? 'border-red-200 bg-red-50 text-red-800'
                                : 'border-amber-200 bg-amber-50 text-amber-900';
                        return (
                            <div key={`${note.key || note.name}-${index}`} className={`rounded-md border px-3 py-2 text-xs ${toneClasses}`}>
                                <p className="font-semibold">{note.name}</p>
                                <p>{note.messages.join(' ')}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderMobileCaptureActions = ({
        type,
        title,
        description,
        galleryLabel = t.chooseFromGallery,
        multipleGallery = false,
        disabled = false,
    }) => (
        <div className="grid gap-3 sm:hidden">
            <label className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-brand-200 bg-brand-600 px-4 py-5 text-center text-white shadow-sm transition active:scale-[0.99] ${disabled ? 'pointer-events-none opacity-50' : 'hover:bg-brand-700'}`}>
                <Camera className="mb-2 h-9 w-9" />
                <span className="text-base font-semibold">{t.takePhoto}</span>
                <span className="mt-1 text-xs text-brand-50">{title}</span>
                <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileChange(e, type)}
                    disabled={disabled}
                />
            </label>

            <label className={`flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-brand-200 bg-white px-4 py-4 text-center text-brand-700 transition active:scale-[0.99] ${disabled ? 'pointer-events-none opacity-50' : 'hover:bg-brand-50'}`}>
                <FolderOpen className="mb-2 h-8 w-8" />
                <span className="text-sm font-semibold">{galleryLabel}</span>
                <span className="mt-1 text-xs text-slate-500">{description}</span>
                <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple={multipleGallery}
                    onChange={(e) => handleFileChange(e, type)}
                    disabled={disabled}
                />
            </label>

            <p className="text-center text-xs text-slate-500">{t.mobileCaptureHint}</p>
        </div>
    );

    return (
        <div className="mb-5 flex flex-col gap-5">
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
                            type="button"
                            aria-label="Close zoomed image"
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
                className={`relative rounded-lg border-2 border-dashed bg-white p-5 transition-all duration-300 ${isDraggingDerm ? 'scale-[1.01] border-brand-500 bg-brand-50 shadow-lg' : ''} ${dermFiles.length === 0 ? 'border-brand-300 hover:border-brand-500 hover:bg-brand-50/50 hover:shadow-lg hover:scale-[1.01]' : 'border-brand-600 bg-brand-50/20 shadow-md'}`}
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
                {dermFiles.length > 0 && (
                    <button type="button" aria-label="Clear dermoscopic images" onClick={() => clearFile('dermoscopic')}>
                        <X className="w-8 h-8 text-gray-400 hover:text-red-500" />
                    </button>
                )}
                </div>

                    {renderCaptureGuide()}
                    {renderQualityNotes()}

                    {dermPreviews.length === 0 ? (
                        <>
                            {renderMobileCaptureActions({
                                type: 'dermoscopic',
                                title: t.uploadDermoscopy,
                                description: t.uploadDermoscopyDesc,
                                multipleGallery: true,
                                disabled: dermFiles.length >= 4,
                            })}
                            <label className="hidden h-56 cursor-pointer flex-col items-center justify-center group sm:flex">
                                <div className="p-4 mb-3 bg-brand-100 rounded-full group-hover:bg-brand-200 transition-colors group-hover:scale-110 duration-300"><Upload className="w-14 h-14 text-brand-600" /></div>
                                <span className="text-lg font-medium text-brand-700 group-hover:text-brand-800 transition-colors">{t.uploadDermoscopy}</span>
                                <span className="text-base text-gray-400 mt-1">{t.uploadDermoscopyDesc}</span>
                                <span className="text-sm text-brand-600 font-medium mt-3">{t.orDragImagesHere}</span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                                    multiple
                                    onChange={(e) => handleFileChange(e, 'dermoscopic')}
                                    disabled={dermFiles.length >= 4}
                                />
                            </label>
                        </>
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
                                    <button
                                        type="button"
                                        aria-label={`Zoom dermoscopic image ${index + 1}`}
                                        className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/20 opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white sm:bg-black/40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                                        onClick={() => setZoomedImage(preview)}
                                    >
                                        <ZoomIn className="w-8 h-8 text-white" />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Remove dermoscopic image ${index + 1}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            clearFile('dermoscopic', index);
                                        }}
                                        className="absolute top-2 right-2 z-10 rounded-lg bg-red-500/80 p-1 opacity-100 transition-opacity hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                                    >
                                        <X className="w-4 h-4 text-white" />
                                    </button>
                                    <div className="absolute bottom-2 left-2 right-2 z-10 flex gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                                        <button
                                            type="button"
                                            title={t.rotateImage}
                                            aria-label={`${t.rotateImage} ${index + 1}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                editDermoscopicImage?.(index, 'rotate-right');
                                            }}
                                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                                        >
                                            <RotateCw className="h-3.5 w-3.5" />
                                            {t.rotateImage}
                                        </button>
                                        <button
                                            type="button"
                                            title={t.cropSquare}
                                            aria-label={`${t.cropSquare} ${index + 1}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                editDermoscopicImage?.(index, 'crop-square');
                                            }}
                                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                                        >
                                            <Crop className="h-3.5 w-3.5" />
                                            {t.cropSquare}
                                        </button>
                                    </div>
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
                                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
                className={`relative rounded-lg border-2 border-dashed bg-white p-5 transition-all duration-300 ${isDraggingClin ? 'scale-[1.01] border-slate-500 bg-slate-50 shadow-lg' : ''} ${!clinFile ? 'border-slate-300 hover:border-brand-400 hover:bg-slate-50 hover:shadow-lg hover:scale-[1.01]' : 'border-brand-600 bg-brand-50/20 shadow-md'}`}
                onDragOver={(e) => handleDragOver(e, 'clin')}
                onDragLeave={(e) => handleDragLeave(e, 'clin')}
                onDrop={(e) => handleDrop(e, 'clinical')}
              >
                <div className="flex justify-between mb-4">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-700 text-lg">
                        <ImageIcon className="w-8 h-8 text-brand-600" /> {t.clinicalHeader}
                        <span className="text-[13px] font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full uppercase">{t.optional}</span>
                    </h3>
                    {clinFile && (
                        <button type="button" aria-label="Clear clinical image" onClick={() => clearFile('clinical')}>
                            <X className="w-8 h-8 text-gray-400 hover:text-red-500" />
                        </button>
                    )}
                </div>

                    {!clinPreview ? (
                        <>
                            {renderMobileCaptureActions({
                                type: 'clinical',
                                title: t.uploadClinicalView,
                                description: t.clinicalDesc,
                                galleryLabel: t.chooseFromFiles,
                            })}
                            <label className="hidden h-56 cursor-pointer flex-col items-center justify-center group sm:flex">
                                <div className="p-4 mb-3 bg-slate-100 rounded-full group-hover:bg-brand-100 transition-colors group-hover:scale-110 duration-300"><Upload className="w-14 h-14 text-slate-500 group-hover:text-brand-600 transition-colors" /></div>
                                <span className="text-lg font-medium text-slate-600 group-hover:text-brand-700 transition-colors">{t.uploadClinicalView}</span>
                                <span className="text-base text-gray-400 mt-1">{t.clinicalDesc}</span>
                                <span className="mt-3 text-sm font-medium text-brand-700">{t.orDragImageHere}</span>
                                <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => handleFileChange(e, 'clinical')} />
                            </label>
                        </>
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
