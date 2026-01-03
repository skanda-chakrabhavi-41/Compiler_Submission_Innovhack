import { firebaseConfig, GEMINI_API_KEY } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, onSnapshot, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// --- Custom Alert with Blur ---
// Override the default window.alert to add a blur effect to the background
const originalAlert = window.alert;
window.alert = function(message) {
    // Apply blur class to the body or a main container
    document.body.classList.add('blur-background');
    
    // Use a small timeout to ensure the UI updates before the alert blocks execution
    setTimeout(() => {
        originalAlert(message);
        // Remove blur class after the alert is closed
        document.body.classList.remove('blur-background');
    }, 10);
};

// Override the default window.confirm to add a blur effect to the background
const originalConfirm = window.confirm;
window.confirm = function(message) {
    document.body.classList.add('blur-background');
    const result = originalConfirm(message);
    document.body.classList.remove('blur-background');
    return result;
};

// Override the default window.prompt to add a blur effect to the background
const originalPrompt = window.prompt;
window.prompt = function(message, defaultValue) {
    document.body.classList.add('blur-background');
    const result = originalPrompt(message, defaultValue);
    document.body.classList.remove('blur-background');
    return result;
};

// --- AI Functions ---

export async function analyzeGrievance(title, description, category, address) {
    try {
        const prompt = `
        Analyze this grievance:
        Title: ${title}
        Description: ${description}
        Category: ${category}
        Address: ${address}

        Provide a JSON response with:
        1. "priority": "High", "Medium", or "Low" based on urgency and location context.
        2. "summary": A one-sentence summary including the location.
        3. "tags": Array of 3 keywords.
        4. "cause": The likely root cause of the problem (e.g., "Infrastructure Failure", "Lack of Maintenance", "Weather Damage", "Human Error", "Traffic Congestion").
        `;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        // Simple cleanup to get JSON if markdown is included
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("AI Analysis Error:", error);
        return { priority: "Medium", summary: description.substring(0, 50) + "...", tags: [category], cause: "Unknown" };
    }
}

export async function generateSocialPost(grievance) {
    try {
        const prompt = `
        You are a community journalist reporting on local issues. Write a short, engaging social media post (like a Tweet or Facebook post) about this unresolved community issue to raise awareness.
        
        Start the post by clearly stating the classification of the problem (e.g., "🚨 Infrastructure Alert", "⚠️ Maintenance Issue").
        Focus on the specific details of the grievance, the likely cause, and the impact on the community.
        Use emojis.
        
        Issue: ${grievance.title}
        Details: ${grievance.description}
        Likely Cause: ${grievance.aiCause || "Under Investigation"}
        Location: ${grievance.municipality}
        Specific Address: ${grievance.address}
        `;
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        return `📢 Attention ${grievance.municipality}: ${grievance.title} at ${grievance.address} needs attention!`;
    }
}

export async function generateAdminSuggestions(grievances) {
    try {
        // Summarize grievances for context
        const summary = grievances.map(g => `- ${g.category}: ${g.title} (${g.status})`).join('\n');
        
        const prompt = `
        You are a government senior data analyst. Based on these grievances provided highlight those issues and mention what are the problems that people are facing.give a suitable timeline to resolve these issues and how to manage the time for every issue effectively. make it easy to read and small.
        Grievances:
        ${summary}
        `;
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        return "Unable to generate suggestions at this time.";
    }
}

// --- Auth Functions ---
export { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, onSnapshot, GoogleAuthProvider, signInWithPopup, sendEmailVerification, getDoc, setDoc, deleteDoc };
