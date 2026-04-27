# Attendance System Setup Guide

## 1. Clone the project

git clone https://github.com/AdrianCanilao/attendance-system.git

## 2. Backend setup

cd backend
python -m venv .venv
..venv\Scripts\activate
pip install -r requirements.txt

## 3. Run backend

uvicorn main:app --reload

## 4. Frontend setup

cd ..
npm install

## 5. Run frontend

npm run dev

## 6. Open in browser

http://localhost:5173

---

## Notes

* Make sure Supabase keys are correct
* Use the same Supabase project for testing
* Allow camera access for face recognition
