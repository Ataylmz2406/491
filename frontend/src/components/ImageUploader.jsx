import React from 'react';
import { Camera, ImageIcon, Upload, X } from 'lucide-react';

export default function ImageUploader({
    dermFile, dermPreview, clinFile, clinPreview, handleFileChange, clearFile,
    showClinical = true
}) {
    return (
        <div className="flex flex-col gap-6 mb-6">
            {/* Dermoscopic */}
            <div className={`relative p-6 transition-all duration-300 bg-white border-2 border-dashed rounded-xl ${!dermFile ? 'border-brand-300 hover:border-brand-500 hover:bg-brand-50/50 hover:shadow-lg hover:scale-[1.01]' : 'border-brand-600 bg-brand-50/20 shadow-md'}`}>
                <div className="flex justify-between mb-4">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-700 text-lg">
                        <Camera className="w-8 h-8 text-brand-600" /> Dermoscopic
                        <span className="text-[13px] font-bold text-brand-700 bg-brand-100 px-3 py-1 rounded-full uppercase">Required</span>
                    </h3>
                    {dermFile && <button onClick={() => clearFile('dermoscopic')}><X className="w-8 h-8 text-gray-400 hover:text-red-500" /></button>}
                </div>

                {!dermPreview ? (
                    <label className="flex flex-col items-center justify-center h-56 cursor-pointer group">
                        <div className="p-4 mb-3 bg-brand-100 rounded-full group-hover:bg-brand-200 transition-colors group-hover:scale-110 duration-300"><Upload className="w-14 h-14 text-brand-600" /></div>
                        <span className="text-lg font-medium text-brand-700 group-hover:text-brand-800 transition-colors">Upload Dermoscopy</span>
                        <span className="text-base text-gray-400 mt-1">High-resolution close-up (JPG, PNG)</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'dermoscopic')} />
                    </label>
                ) : (
                    <div className="relative h-44 w-44 mx-auto overflow-hidden bg-black rounded-lg group">
                        <img src={dermPreview} className="object-contain w-full h-full" alt="Dermoscopic preview" />
                    </div>
                )}
            </div>

            {/* Clinical */}
            {showClinical && (
              <div className={`relative p-6 transition-all duration-300 bg-white border-2 border-dashed rounded-xl ${!clinFile ? 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30 hover:shadow-lg hover:scale-[1.01]' : 'border-indigo-600 bg-indigo-50/20 shadow-md'}`}>
                <div className="flex justify-between mb-4">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-700 text-lg">
                        <ImageIcon className="w-8 h-8 text-indigo-600" /> Clinical
                        <span className="text-[13px] font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full uppercase">Optional</span>
                    </h3>
                    {clinFile && <button onClick={() => clearFile('clinical')}><X className="w-8 h-8 text-gray-400 hover:text-red-500" /></button>}
                </div>

                {!clinPreview ? (
                    <label className="flex flex-col items-center justify-center h-56 cursor-pointer group">
                        <div className="p-4 mb-3 bg-gray-100 rounded-full group-hover:bg-indigo-100 transition-colors group-hover:scale-110 duration-300"><Upload className="w-14 h-14 text-gray-500 group-hover:text-indigo-600 transition-colors" /></div>
                        <span className="text-lg font-medium text-gray-600 group-hover:text-indigo-700 transition-colors">Upload Clinical View</span>
                        <span className="text-base text-gray-400 mt-1">Macro/Regional photo</span>
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
