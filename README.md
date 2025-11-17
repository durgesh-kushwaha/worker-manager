# 📌 Worker Manager (LocalStorage + IndexedDB)

> A modern, mobile-friendly Worker Management Web Application that stores worker data directly in the browser using **LocalStorage/IndexedDB (via localForage)** and supports exporting daily worker reports as **PDF**, **Image (PNG)**, **CSV**, and **JSON**.

This project is fully client-side, requires **no backend**, and works entirely offline after the first load.

---

## ⭐ Features

### 🔹 1. Add / Update / Delete Workers
* Add workers with:
  * PID  
  * Name  
  * Position  
  * Working Hours  
* Update worker details anytime  
* Remove workers from the database  

---

### 🔹 2. Daily Worker List (“Today’s List”)
Select workers present on a given day:
* Add single worker  
* Add all workers (bulk add)  
* Remove selected worker  
* Clear the entire daily list  

All entries appear in a modern, searchable, sortable table.

---

### 🔹 3. Modern Export Options

#### ✔ PDF Export (jsPDF + autoTable)
* Centered company logo  
* Modern teal header row  
* Zebra row styling  
* Crisp table layout  
* Page numbers + date footer  
* Filename → `workers-DD-MM-YYYY.pdf`

#### ✔ Image Export (PNG)
* A4-layout canvas  
* Centered logo  
* Teal header  
* Zebra rows  
* Filename → `workers-DD-MM-YYYY.png`

---

### 🔹 4. CSV Import & Export
* Export all saved workers to `workers.csv`  
* Import CSV files from mobile/desktop  
* Auto-detects delimiters (`,` `;` `tab`)  
* Automatically:
  * Adds new workers  
  * Updates existing workers  
  * Skips invalid rows  

---

### 🔹 5. Search & Sorting
* Live search by ID, name, or position  
* Click column headers to sort (ascending/descending)  
* Fully responsive table  

---

### 🔹 6. Logo Upload
* Upload a company logo (horizontal recommended)  
* Stored in IndexedDB (Base64 format)  
* Included automatically in PDF & PNG exports  
* Clear logo anytime  

---

### 🔹 7. Date Handling
* Date auto-filled based on today's date  
* Export date shown in **DD-MM-YYYY** format  
* Date also used in all exported filenames  

---

### 🔹 8. JSON Backup
* Download full worker records in `workers.json` for backup/migration.  

---

### 🔹 9. Mobile Responsive Design
* TailwindCSS responsive utilities  
* Clean, stacked layout on mobile  
* Touch-friendly table actions  
* Optimized for Android and iOS  

---

### 🔹 10. Offline Persistent Storage
Everything saves locally using `localForage`:
* Works offline  
* Survives page refreshes  
* Survives browser restarts  
* Super-fast querying via IndexedDB  

---

## 🛠️ Tech Stack

| Area | Technology |
| :---------------------- | :--------------------------- |
| **UI Layout**           | HTML5 + TailwindCSS         |
| **Frontend Logic**      | Vanilla JavaScript           |
| **Local Storage**       | IndexedDB via `localForage` |
| **PDF Export**          | jsPDF + autoTable plugin    |
| **Image Export**        | Canvas API (manual drawing) |
| **CSV Import/Export**   | Custom CSV parser           |
| **Deployment**          | Netlify / Vercel / GitHub Pages |

---

## 📂 Project Structure

```
/
│── index.html        # Main web interface
│── script.js         # All logic, storage, table rendering, exports
│── style.css         # Extra styles (optional)
│── README.md         # Project documentation
```

---

## ⚙️ How It Works

### **Worker Storage**
Workers are saved in IndexedDB using localForage.  
A typical record looks like:

```json
{
  "id": "001",
  "name": "John Doe",
  "position": "Helper",
  "hours": "08"
}
```

---

### **Selected Workers (“Today’s List”)**
Workers added to the daily list are stored separately:

```json
[
  { "id": "001", "name": "John", "position": "Helper", "hours": "08" },
  { "id": "002", "name": "Rahul", "position": "Electrician", "hours": "09" }
]
```

Supports:
* Add  
* Edit  
* Remove  
* Add All  
* Clear all  

---

## 🖨️ Export Logic

### **PDF**
* A4 portrait layout  
* Logo rendered at the top  
* AutoTable handles:
  - Column spacing  
  - Header color  
  - Zebra rows  
  - Line borders  
* Generated per-page footer with:
  - Date  
  - Page numbers  

### **Image (PNG)**
* Layout drawn using Canvas API  
* Same visual design as the PDF  
* Centered logo + table + footer date  

---

## 📤 CSV Export
Exports all workers with:

```
id,name,position,hours
```

---

## 📥 CSV Import
Handles:
* Comma-separated  
* Semicolon-separated  
* Tab-separated  
* Quoted text  
* Multi-line data  

Automatically updates or adds workers.

---

## 🚀 Deployment

This is a static website, so deployment is extremely simple.

### **Netlify**
1. Drag & drop your project folder  
2. Done  

### **Vercel**
```
vercel deploy
```

### **GitHub Pages**
1. Push project  
2. Enable Pages  
3. Select branch  
4. Live  

---

## 🔐 Privacy & Offline Support

* No external server  
* No data ever leaves the device  
* Perfect for offline usage on job sites  
* Supports mobile browsers fully  

---

## 📌 Known Limitations

* Very large logos may appear compressed  
* Clearing browser site data removes stored workers  
* CSV import must follow required structure  

---

## 📈 Future Improvements (Optional)

* Dark mode  
* Cloud sync  
* Attendance history tracking  
* QR/Barcode ID support  
* Worker categories  

---

## ❤️ Credits

**Made with ❤️ by Durgesh Kushwaha**

