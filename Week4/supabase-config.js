const SUPABASE_URL = 'https://dwsfwzleiybjunoqcudh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3c2Z3emxlaXlianVub3FjdWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODA4MzYsImV4cCI6MjA5NDk1NjgzNn0.937zxZij7-vQYK4GyoKn1VOfRxPSo-VAh1-aOyOjHF0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
