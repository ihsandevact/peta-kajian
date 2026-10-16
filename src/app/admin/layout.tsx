import React from 'react';
import type { Metadata } from 'next';
import AdminLayoutShell from '@/components/AdminLayoutShell';

export const metadata: Metadata = {
  title: 'Admin Portal - Peta Kajian',
  description: 'Portal Kurasi, Moderasi, & Manajemen Sistem Peta Kajian',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
