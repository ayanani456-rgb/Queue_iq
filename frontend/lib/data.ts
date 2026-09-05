export const MOCK_DATA_NOTICE = 'Mock data for UI preview only — replace with backend/API data before production.';

// TODO: Backend team - replace with real API /api/organizations
export const STATUS_MAP = {
  live: { label: 'Live', dot: 'bg-[#10B981]', text: 'text-[#10B981]', ring: 'border-[#10B981]/30 bg-[#10B981]/10' },
  filling: { label: 'Filling Fast', dot: 'bg-[#F59E0B]', text: 'text-[#F59E0B]', ring: 'border-[#F59E0B]/30 bg-[#F59E0B]/10' },
  closed: { label: 'Closed', dot: 'bg-[#EF4444]', text: 'text-[#EF4444]', ring: 'border-[#EF4444]/30 bg-[#EF4444]/10' },
};

export const CATEGORY_MAP = {
  bank: [{ icon: '💰', label: 'Account Opening' }, { icon: '📋', label: 'Loan Inquiry' }, { icon: '💳', label: 'Card Services' }, { icon: '🏦', label: 'Cash Deposit/Withdrawal' }],
  salon: [{ icon: '✂', label: 'Haircut' }, { icon: '💆', label: 'Massage' }, { icon: '💅', label: 'Manicure/Pedicure' }],
  lab: [{ icon: '🧪', label: 'Blood Test' }, { icon: '🩻', label: 'X-Ray' }, { icon: '🫀', label: 'ECG' }, { icon: '🧬', label: 'Full Body Checkup' }],
  government: [{ icon: '🆔', label: 'ID Card' }, { icon: '📄', label: 'Document Renewal' }, { icon: '📝', label: 'New Registration' }, { icon: '🛂', label: 'Passport' }],
};

// --- REAL DEPARTMENTS - Fallback to mock if Supabase fails ---
export const DEPARTMENTS = [
  { id: 'cardio', name: 'Cardiologist', icon: '🫀' },
  { id: 'derma', name: 'Dermatologist', icon: '🧴' },
  { id: 'gp', name: 'General Physician', icon: '🏥' },
  { id: 'dentist', name: 'Dentist', icon: '🦷' },
  { id: 'neuro', name: 'Neurologist', icon: '🧠' },
  { id: 'ortho', name: 'Orthopedic', icon: '🦴' },
];

export const DOCTORS_BY_DEPT: any = {
  cardio: [
    { id: 'd1', name: 'Dr. Ayesha Khan', specialty: 'Cardiologist', experience: 12, rating: 4.9, reviews: 214, fee: 1500, bio: 'Interventional cardiologist specializing in angioplasty and heart failure management.', schedule: [{ days: ['Mon', 'Wed', 'Fri'], start: '10:00', end: '14:00' }, { days: ['Tue', 'Thu'], start: '17:00', end: '20:00' }] },
    { id: 'd2', name: 'Dr. Salman Iqbal', specialty: 'Cardiologist', experience: 8, rating: 4.6, reviews: 132, fee: 1500, bio: 'Focuses on preventive cardiology and hypertension management.', schedule: [{ days: ['Tue', 'Thu', 'Sat'], start: '11:00', end: '15:00' }] },
    { id: 'd3', name: 'Dr. Rabia Hassan', specialty: 'Cardiologist', experience: 15, rating: 4.8, reviews: 301, fee: 1800, bio: 'Senior consultant, echocardiography and arrhythmia specialist.', schedule: [{ days: ['Mon', 'Thu'], start: '09:00', end: '12:00' }] },
  ],
  derma: [
    { id: 'd4', name: 'Dr. Omar Siddiqui', specialty: 'Dermatologist', experience: 9, rating: 4.7, reviews: 180, fee: 1400, bio: 'Cosmetic and clinical dermatology, acne and pigmentation specialist.', schedule: [{ days: ['Mon', 'Wed'], start: '15:00', end: '18:00' }] },
    { id: 'd5', name: 'Dr. Zoya Ahmed', specialty: 'Dermatologist', experience: 6, rating: 4.5, reviews: 97, fee: 1400, bio: 'Specializes in eczema, psoriasis and pediatric skin conditions.', schedule: [{ days: ['Tue', 'Fri'], start: '10:00', end: '13:00' }] },
  ],
  gp: [
    { id: 'd6', name: 'Dr. Ahmed Raza', specialty: 'General Physician', experience: 10, rating: 4.8, reviews: 412, fee: 800, bio: 'Family medicine, chronic disease management.', schedule: [{ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '13:00' }] },
    { id: 'd7', name: 'Dr. Sana Malik', specialty: 'General Physician', experience: 7, rating: 4.6, reviews: 256, fee: 800, bio: 'Focuses on women’s primary care and travel medicine.', schedule: [{ days: ['Mon', 'Wed', 'Fri'], start: '16:00', end: '20:00' }] },
  ],
  dentist: [
    { id: 'd8', name: 'Dr. Hina Yousuf', specialty: 'Dentist', experience: 11, rating: 4.9, reviews: 198, fee: 1200, bio: 'Root canal and cosmetic dentistry specialist.', schedule: [{ days: ['Mon', 'Thu'], start: '10:00', end: '13:00' }] },
  ],
  neuro: [
    { id: 'd9', name: 'Dr. Mahnoor Sheikh', specialty: 'Neurologist', experience: 14, rating: 4.9, reviews: 267, fee: 2000, bio: 'Epilepsy and stroke management specialist.', schedule: [{ days: ['Tue', 'Thu'], start: '11:00', end: '14:00' }] },
  ],
  ortho: [
    { id: 'd10', name: 'Dr. Farhan Iqbal', specialty: 'Orthopedic', experience: 13, rating: 4.7, reviews: 189, fee: 1600, bio: 'Sports injuries and joint replacement.', schedule: [{ days: ['Mon', 'Wed', 'Fri'], start: '14:00', end: '17:00' }] },
  ],
};

export const CITY_DOCTORS_BY_DEPT: any = {
  gp: [
    { id: 'city_d1', name: 'Dr. Tariq Mahmood', specialty: 'General Physician', experience: 14, rating: 4.8, reviews: 310, fee: 1000, bio: 'General diagnosis, family medicine, hypertension & fever care.', schedule: [{ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '14:00' }] },
    { id: 'city_d2', name: 'Dr. Nadia Khan', specialty: 'General Physician', experience: 8, rating: 4.6, reviews: 145, fee: 1000, bio: 'Primary healthcare, women routine checkups and preventive health.', schedule: [{ days: ['Mon', 'Wed', 'Sat'], start: '16:00', end: '20:00' }] },
  ],
  cardio: [
    { id: 'city_d3', name: 'Dr. Kamran Ali', specialty: 'Cardiologist', experience: 11, rating: 4.7, reviews: 180, fee: 1800, bio: 'Clinical cardiology, ECG, echocardiography and heart wellness.', schedule: [{ days: ['Tue', 'Thu', 'Sat'], start: '11:00', end: '15:00' }] },
    { id: 'city_d4', name: 'Dr. Faisal Rauf', specialty: 'Cardiologist', experience: 9, rating: 4.5, reviews: 112, fee: 1600, bio: 'Cardiac diagnostics, chest pain and BP management.', schedule: [{ days: ['Mon', 'Wed', 'Fri'], start: '10:00', end: '13:00' }] },
  ],
  derma: [
    { id: 'city_d5', name: 'Dr. Sadaf Naz', specialty: 'Dermatologist', experience: 7, rating: 4.7, reviews: 154, fee: 1200, bio: 'Cosmetic dermatology, allergies, acne and skin care.', schedule: [{ days: ['Mon', 'Thu'], start: '14:00', end: '18:00' }] },
  ],
  dentist: [
    { id: 'city_d6', name: 'Dr. Bilal Saeed', specialty: 'Dentist', experience: 10, rating: 4.8, reviews: 220, fee: 1000, bio: 'Dentistry, root canal, scaling and extraction.', schedule: [{ days: ['Tue', 'Fri'], start: '10:00', end: '14:00' }] },
  ],
  neuro: [
    { id: 'city_d7', name: 'Dr. Waqas Ahmed', specialty: 'Neurologist', experience: 12, rating: 4.9, reviews: 195, fee: 2000, bio: 'Neurology, headaches, stroke recovery and nerve care.', schedule: [{ days: ['Mon', 'Wed'], start: '11:00', end: '14:00' }] },
  ],
  ortho: [
    { id: 'city_d8', name: 'Dr. Asad Ullah', specialty: 'Orthopedic', experience: 15, rating: 4.8, reviews: 240, fee: 1800, bio: 'Orthopedic surgery, fractures, spine and joint pain.', schedule: [{ days: ['Tue', 'Thu', 'Sat'], start: '15:00', end: '19:00' }] },
  ],
};

// Helper to merge real Supabase doctors into mock structure
export function mergeRealDoctors(realDoctors: any[]) {
  if (!realDoctors || realDoctors.length === 0) return DOCTORS_BY_DEPT
  const grouped: any = { ...DOCTORS_BY_DEPT }
  realDoctors.forEach((doc: any) => {
    const deptId = doc.department_id || doc.dept_id || 'gp'
    if (!grouped[deptId]) grouped[deptId] = []
    // Avoid duplicates
    if (!grouped[deptId].find((d: any) => d.id === doc.id)) {
      grouped[deptId].push({
        id: doc.id,
        name: doc.name,
        specialty: doc.specialty || doc.department,
        experience: doc.experience || 5,
        rating: doc.rating || 4.5,
        reviews: doc.reviews || 10,
        fee: doc.fee || 1000,
        bio: doc.bio || '',
        schedule: doc.schedule || [{ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '17:00' }]
      })
    }
  })
  return grouped
}

export const CLINICS = {
  alshifa: {
    id: 'alshifa', orgCode: 'SHIF', name: 'Al-Shifa Clinic', rating: 4.8, address: 'Block 6, Gulberg, Lahore', distance: 0.5,
    hours: { open: '09:00', close: '21:00' }, departments: [
      { id: 'cardio', name: 'Cardiologist', icon: '🫀', count: 5 },
      { id: 'derma', name: 'Dermatologist', icon: '🧴', count: 3 },
      { id: 'gp', name: 'General Physician', icon: '🏥', count: 8 },
      { id: 'dentist', name: 'Dentist', icon: '🦷', count: 2 },
      { id: 'neuro', name: 'Neurologist', icon: '🧠', count: 4 },
      { id: 'ortho', name: 'Orthopedic', icon: '🦴', count: 2 },
    ],
  },
  citymedical: {
    id: 'citymedical', orgCode: 'CITY', name: 'City Medical Center', rating: 4.5, address: 'Main Boulevard, DHA Phase 5, Lahore', distance: 1.2,
    hours: { open: '08:00', close: '22:00' }, departments: [
      { id: 'cardio', name: 'Cardiologist', icon: '🫀', count: 3 },
      { id: 'derma', name: 'Dermatologist', icon: '🧴', count: 2 },
      { id: 'gp', name: 'General Physician', icon: '🏥', count: 5 },
      { id: 'dentist', name: 'Dentist', icon: '🦷', count: 1 },
      { id: 'neuro', name: 'Neurologist', icon: '🧠', count: 2 },
      { id: 'ortho', name: 'Orthopedic', icon: '🦴', count: 3 },
    ],
  },
};

export const BUSINESS_ACCOUNTS = {
  'admin@alshifa.com': { password: '123456', orgName: 'Al-Shifa Clinic', orgCode: 'SHIF', orgType: 'clinic', type: 'owner', tokensToday: 42, nowServing: 'A-15', revenue: 'Rs. 33,600', noShows: 2 },
  'admin@citymedical.com': { password: '123456', orgName: 'City Medical Center', orgCode: 'CITY', orgType: 'clinic', type: 'owner', tokensToday: 28, nowServing: 'C-09', revenue: 'Rs. 18,200', noShows: 1 },
  'admin@nadra.com': { password: '123456', orgName: 'NADRA Gulberg', orgCode: 'NADR', orgType: 'government', type: 'owner', tokensToday: 156, nowServing: 'G-89', revenue: 'Govt Service', noShows: 5 },
  'admin@styleloft.com': { password: '123456', orgName: 'Style Loft Salon', orgCode: 'STYL', orgType: 'salon', type: 'owner', tokensToday: 19, nowServing: 'S-07', revenue: 'Rs. 15,000', noShows: 0 },
  'reception@alshifa.com': { password: '123456', orgName: 'Al-Shifa Clinic', orgCode: 'SHIF', orgType: 'clinic', type: 'receptionist' },
  'dr.ayesha@alshifa.com': { password: '123456', orgName: 'Al-Shifa Clinic', orgCode: 'SHIF', orgType: 'clinic', type: 'doctor', doctorId: 'd1', doctorName: 'Dr. Ayesha Khan' },
};

export const MOCK_QUEUE_SEED = {
  SHIF: [
    { token: 'A-14', phone: '0300-1234567', doctor: 'Dr. Ayesha Khan', time: '10:15', status: 'Done' },
    { token: 'A-15', phone: '0301-2345678', doctor: 'Dr. Ayesha Khan', time: '10:30', status: 'Serving' },
    { token: 'A-16', phone: '0302-3456789', doctor: 'Dr. Rabia Hassan', time: '10:45', status: 'Waiting' },
    { token: 'A-17', phone: '0303-4567890', doctor: 'Dr. Ayesha Khan', time: '11:00', status: 'Waiting' },
  ],
};
