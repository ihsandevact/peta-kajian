'use client';

import React from 'react';
import {
  type NavigationVehicleIcon,
  VEHICLE_OPTIONS,
  setStoredVehicleIcon,
} from '@/utils/navigationVehicle';

interface VehiclePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIcon: NavigationVehicleIcon;
  onSelect: (icon: NavigationVehicleIcon) => void;
}

export default function VehiclePickerModal({
  isOpen,
  onClose,
  currentIcon,
  onSelect,
}: VehiclePickerModalProps) {
  if (!isOpen) return null;

  const handleChoose = (id: NavigationVehicleIcon) => {
    setStoredVehicleIcon(id);
    onSelect(id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 font-geist"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface-container-lowest rounded-3xl p-5 sm:p-6 shadow-2xl border border-surface-container-high/80 text-on-surface animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-surface-container-high/60">
          <div>
            <h3 className="font-extrabold text-base text-on-surface tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                directions_car
              </span>
              <span>Pilih Kendaraan Navigasi</span>
            </h3>
            <p className="text-xs text-outline mt-0.5">
              Pilih kendaraan yang Anda gunakan (Mobil atau Motor)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup dialog"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Grid Opsi Kendaraan */}
        <div className="grid grid-cols-2 gap-2.5 py-4">
          {VEHICLE_OPTIONS.map((opt) => {
            const isSelected = currentIcon === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleChoose(opt.id)}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer text-center relative ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-xs ring-2 ring-primary/30 scale-[1.02]'
                    : 'bg-surface-container/60 hover:bg-surface-container border-surface-container-high/60 hover:border-surface-container-high text-on-surface'
                }`}
              >
                {/* Checkmark jika terpilih */}
                {isSelected && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[14px] font-bold">
                      check
                    </span>
                  </span>
                )}

                {/* Badge Lingkaran Ikon */}
                <div
                  className={`w-12 h-12 rounded-2xl ${opt.badgeBg} text-white flex items-center justify-center mb-2 shadow-md transition-transform group-hover:scale-110`}
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {opt.icon}
                  </span>
                </div>

                {/* Label & Deskripsi */}
                <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                  {opt.label}
                </span>
                <span className="text-[10px] text-outline mt-0.5 leading-snug line-clamp-1">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="pt-2 border-t border-surface-container-high/60 flex items-center gap-2 text-[11px] text-outline">
          <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
            info
          </span>
          <span>
            Ikon akan berputar otomatis mengikuti arah hadap kompas &amp; perjalanan Anda.
          </span>
        </div>
      </div>
    </div>
  );
}
