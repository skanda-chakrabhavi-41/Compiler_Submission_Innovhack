import { db, collection, updateDoc, doc, query, orderBy, onSnapshot, addDoc, auth, onAuthStateChanged, getDoc } from './ai.js';
import { generateAdminSuggestions, generateSocialPost } from './ai.js';

// Admin Access Control
const ADMIN_EMAILS = ["admin@municipality.com", "mukulguptaalw2006@gmail.com"]; // Add your admin emails here

onAuthStateChanged(auth, (user) => {
    if (!user) {
        // User is not logged in (or just logged out)
        window.location.href = "index.html";
        return;
    }
    
    if (!ADMIN_EMAILS.includes(user.email)) {
        alert("Access Denied. You do not have admin privileges.");
        window.location.href = "index.html";
        return;
    }
    
    // If authorized, load data
    loadAdminGrievances();
});

const adminGrievancesContainer = document.getElementById('admin-grievances');
const filterMunicipality = document.getElementById('filter-municipality');
const showVerifiedCheckbox = document.getElementById('show-verified-checkbox');
const aiSuggestionsContainer = document.getElementById('ai-suggestions');
const generateInsightsBtn = document.getElementById('generate-insights-btn');

// Stats Elements
const totalCountEl = document.getElementById('total-count');
const pendingCountEl = document.getElementById('pending-count');
const resolvedCountEl = document.getElementById('resolved-count');

let allGrievances = [];

// Load All Grievances
function loadAdminGrievances() {
    const q = query(collection(db, "grievances"), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        allGrievances = [];
        snapshot.forEach((doc) => {
            allGrievances.push({ id: doc.id, ...doc.data() });
        });
        renderGrievances();
        updateStats();
        // checkAndPostSocial(); // Removed: Moved to social.js for auto-updates
    });
}

// Add event listener for the checkbox
if (showVerifiedCheckbox) {
    showVerifiedCheckbox.addEventListener('change', () => {
        renderGrievances();
        updateStats();
    });
}

// Add event listener for municipality filter
if (filterMunicipality) {
    filterMunicipality.addEventListener('change', () => {
        renderGrievances();
        updateStats();
    });
}

function renderGrievances() {
    const selectedMunicipality = filterMunicipality.value;
    const showVerified = showVerifiedCheckbox ? showVerifiedCheckbox.checked : false;

    adminGrievancesContainer.innerHTML = "";

    let filtered = selectedMunicipality === "All" 
        ? allGrievances 
        : allGrievances.filter(g => g.municipality === selectedMunicipality);

    // Filter out verified grievances unless checkbox is checked
    if (!showVerified) {
        filtered = filtered.filter(g => !(g.status === 'Resolved' && g.verified));
    }

    if (filtered.length === 0) {
        adminGrievancesContainer.innerHTML = "<p>No grievances found.</p>";
        return;
    }

    filtered.forEach(data => {
        const card = document.createElement('div');
        card.className = `card ${data.status === 'Resolved' ? 'resolved' : ''}`;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <span class="status-badge ${data.status === 'Pending' ? 'status-pending' : 'status-resolved'}">${data.status}</span>
                <small>${data.aiPriority} Priority</small>
            </div>
            <h3>${data.title}</h3>
            <p>${data.description}</p>
            <p><strong>Submitted By:</strong> ${data.fullName || 'N/A'} (${data.address || 'N/A'})</p>
            <p><strong>Category:</strong> ${data.category}</p>
            <p><strong>Municipality:</strong> ${data.municipality}</p>
            ${data.photo ? `<div style="margin: 10px 0;"><img src="${data.photo}" alt="Grievance Photo" style="max-width: 100%; max-height: 300px; border-radius: 4px;"></div>` : ''}
            <div style="background:#f9f9f9; padding:5px; font-size:0.9rem; margin:10px 0;">
                <strong>AI Summary:</strong> ${data.aiSummary}
            </div>
            ${data.status === 'Pending' ? 
                `<button onclick="resolveGrievance('${data.id}')">Mark as Resolved</button>` : 
                `<p>Status: Resolved ${data.verified ? '(Verified)' : '(Pending Verification)'}</p>`}
        `;
        adminGrievancesContainer.appendChild(card);
    });
}

function updateStats() {
    const selectedMunicipality = filterMunicipality.value;
    const showVerified = showVerifiedCheckbox ? showVerifiedCheckbox.checked : false;

    let filtered = selectedMunicipality === "All" 
        ? allGrievances 
        : allGrievances.filter(g => g.municipality === selectedMunicipality);

    // Update stats based on visibility too? 
    // Usually stats should reflect the database, but maybe "Pending" is what matters most.
    // Let's keep stats reflecting the *current view* or *total database*?
    // Let's make stats reflect the *Active* workload by default.
    
    // Actually, let's keep stats as "Total Database" for the selected municipality, 
    // but maybe separate "Verified" from "Resolved".
    
    const total = filtered.length;
    const pending = filtered.filter(g => g.status === 'Pending').length;
    const resolved = filtered.filter(g => g.status === 'Resolved').length;
    // const verified = filtered.filter(g => g.verified).length;

    totalCountEl.textContent = total;
    pendingCountEl.textContent = pending;
    resolvedCountEl.textContent = resolved;

    // Removed auto-trigger of AI Suggestions
}

// Manual Trigger for AI Insights
generateInsightsBtn.addEventListener('click', () => {
    const selectedMunicipality = filterMunicipality.value;
    const filtered = selectedMunicipality === "All" 
        ? allGrievances 
        : allGrievances.filter(g => g.municipality === selectedMunicipality);
    
    if (filtered.length === 0) {
        aiSuggestionsContainer.innerHTML = "No data to analyze.";
        return;
    }
    updateAISuggestions(filtered.slice(0, 20));
});

async function updateAISuggestions(grievances) {
    aiSuggestionsContainer.innerHTML = "Analyzing data for improvements...";
    try {
        const suggestions = await generateAdminSuggestions(grievances);
        aiSuggestionsContainer.innerHTML = suggestions.replace(/\n/g, '<br>');
    } catch (e) {
        aiSuggestionsContainer.innerHTML = "Error generating insights.";
    }
}

// Event Listeners
filterMunicipality.addEventListener('change', () => {
    renderGrievances();
    updateStats();
});

// Expose functions
window.resolveGrievance = async (id) => {
    const grievanceRef = doc(db, "grievances", id);
    
    // Fetch the grievance first to get the user's email
    getDoc(grievanceRef).then((docSnap) => {
        if (docSnap.exists()) {
            const grievanceData = docSnap.data();
            const userEmail = grievanceData.userEmail;
            const subject = `Grievance Resolved: ${grievanceData.title}`;
            const body = `Dear Citizen,\n\nYour grievance regarding "${grievanceData.title}" has been marked as resolved by the municipality.\n\nPlease log in to the portal to verify the resolution.\n\nThank you,\nMunicipality Team`;
            
            // Construct mailto link
            const mailtoLink = `mailto:${userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
            updateDoc(grievanceRef, {
                status: "Resolved",
                resolvedAt: new Date()
            }).then(() => {
                alert("Grievance marked as resolved.");
                
                // Open default email client
                window.location.href = mailtoLink;
                
            }).catch((error) => {
                console.error("Error resolving grievance:", error);
            });
        } else {
            console.error("No such document!");
        }
    }).catch((error) => {
        console.error("Error getting document:", error);
    });
};

// Init
// loadAdminGrievances(); // Moved to onAuthStateChanged
