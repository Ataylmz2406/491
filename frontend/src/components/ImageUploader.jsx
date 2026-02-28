import React from 'react';
import { Camera, ImageIcon, Upload, X } from 'lucide-react';

export default function ImageUploader({
    dermFile, dermPreview, clinFile, clinPreview, handleFileChange, clearFile,
    showClinical = true
}) {
    return (
        <div className="grid gap-6 mb-8 md:grid-cols-2">
            {/* Dermoscopic */}
            <div className={`relative p-6 transition-all bg-white border-2 border-dashed rounded-xl ${!dermFile ? 'border-teal-300 hover:border-teal-500 hover:bg-teal-50/30' : 'border-teal-600 bg-teal-50/10'}`}>
                <div className="flex justify-between mb-4">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-700">
                        <Camera className="w-5 h-5 text-teal-600" /> Dermoscopic
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full uppercase">Required</span>
                    </h3>
                    {dermFile && <button onClick={() => clearFile('dermoscopic')}><X className="w-5 h-5 text-gray-400 hover:text-red-500" /></button>}
                </div>

                {!dermPreview ? (
                    <label className="flex flex-col items-center justify-center h-96 cursor-pointer">
                        <div className="p-4 mb-3 bg-teal-100 rounded-full"><Upload className="w-8 h-8 text-teal-600" /></div>
                        <span className="text-base font-medium text-teal-700">Upload Dermoscopy</span>
                        <span className="text-sm text-gray-400 mt-1">High-resolution close-up (JPG, PNG)</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'dermoscopic')} />
                    </label>
                ) : (
                    <div className="relative h-96 overflow-hidden bg-black rounded-lg group">
                        <img src={dermPreview} className="object-contain w-full h-full" alt="Dermoscopic preview" />
                    </div>
                )}
            </div>

            {/* Clinical */}
            {showClinical && (
              <div className={`relative p-6 transition-all bg-white border-2 border-dashed rounded-xl ${!clinFile ? 'border-gray-300 hover:border-gray-400 hover:bg-gray-50' : 'border-indigo-500 bg-indigo-50/10'}`}>
                <div className="flex justify-between mb-4">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-700">
                        <ImageIcon className="w-5 h-5 text-indigo-600" /> Clinical
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase">Optional</span>
                    </h3>
                    {clinFile && <button onClick={() => clearFile('clinical')}><X className="w-5 h-5 text-gray-400 hover:text-red-500" /></button>}
                </div>

                {!clinPreview ? (
                    <label className="flex flex-col items-center justify-center h-96 cursor-pointer">
                        <div className="p-4 mb-3 bg-gray-100 rounded-full"><Upload className="w-8 h-8 text-gray-500" /></div>
                        <span className="text-base font-medium text-gray-600">Upload Clinical View</span>
                        <span className="text-sm text-gray-400 mt-1">Macro/Regional photo</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'clinical')} />
                    </label>
                ) : (
                    <div className="relative h-96 overflow-hidden bg-black rounded-lg group">
                        <img src={clinPreview} className="object-contain w-full h-full" alt="Clinical preview" />
                    </div>
                )}
            </div>
            )}
        </div>
    );
}
