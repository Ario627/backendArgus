INSERT INTO parameter_kalibrasi (kunci, nilai, satuan, sumber, catatan) VALUES
  ('susut_wajar_proksi', 0.02, 'proksi', 'literatur', 'Perimeter awal dossier bagian 8.3; wajib kalibrasi pilot'),
  ('toleransi_neraca', 0.05, 'proksi', 'literatur', 'Perimeter awal dossier bagian 8.3; wajib kalibrasi pilot'),
  ('ambang_proporsi_digit', 0.5, 'proksi', 'literatur', 'Perimeter awal dossier bagian 8.3; wajib kalibrasi pilot'),
  ('biaya_per_km', NULL, 'rupiah/km', 'belum_ada', 'Isi dari penawaran nyata sebelum mengaktifkan skor'),
  ('faktor_muat', NULL, 'kg', 'belum_ada', 'Isi dari kapasitas kendaraan riil'),
  ('biaya_tolak', NULL, 'rupiah', 'belum_ada', 'Isi dari waktu + bahan bakar per penolakan'),
  ('penalti_umur_per_jam', NULL, 'rupiah/jam', 'belum_ada', 'Kalibrasi dengan fasilitas'),
  ('kecepatan_kota_km_jam', 20, 'km/jam', 'manual_admin', 'Asumsi konservatif lalu lintas kota')
ON CONFLICT (kunci) DO NOTHING;