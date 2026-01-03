import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, collection, addDoc, query, where, orderBy, onSnapshot, GoogleAuthProvider, signInWithPopup, sendEmailVerification, doc, updateDoc, getDoc, setDoc, deleteDoc, getDocs } from './ai.js';
import { analyzeGrievance } from './ai.js';

// DOM Elements
const authSection = document.getElementById('auth-section');
const userDashboard = document.getElementById('user-dashboard');
const navLinks = document.getElementById('nav-links');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const toggleAuthBtn = document.getElementById('toggle-auth');
const signupFields = document.getElementById('signup-fields');
// const googleBtn = document.getElementById('google-btn'); // Removed
const logoutBtn = document.getElementById('logoutBtn');
const grievanceForm = document.getElementById('grievance-form');
const myGrievancesContainer = document.getElementById('my-grievances');
// const openMapBtn = document.getElementById('open-map-btn'); // Removed

const ADMIN_EMAILS_LIST = ["admin@municipality.com", "mukulguptaalw2006@gmail.com"];

let isLogin = true;
let currentUser = null;

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (user) {
        currentUser = user;
        authSection.style.display = 'none';
        userDashboard.style.display = 'block';
        // navLinks.style.display = 'block'; // Removed: Nav is always visible now
        if(logoutBtn) logoutBtn.style.display = 'inline-block';
        
        // Hide Community Voice link when logged in (filling grievance form)
        const communityVoiceLink = document.querySelector('a[href="social.html"]');
        if (communityVoiceLink) communityVoiceLink.style.display = 'none';

        // Load user profile to pre-fill form
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('full-name').value = userData.name || '';
            // document.getElementById('address').value = userData.address || ''; // Do not pre-fill address
            
            // Make name read-only as it comes from profile
            document.getElementById('full-name').readOnly = true; 
        }

        loadUserGrievances();
    } else {
        currentUser = null;
        authSection.style.display = 'block';
        userDashboard.style.display = 'none';
        // navLinks.style.display = 'none'; // Removed: Nav is always visible now
        if(logoutBtn) logoutBtn.style.display = 'none';

        // Show Community Voice link when not logged in
        const communityVoiceLink = document.querySelector('a[href="social.html"]');
        if (communityVoiceLink) communityVoiceLink.style.display = 'inline-block';
    }
});

// Toggle Login/Signup
toggleAuthBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent form submission if inside a form
    isLogin = !isLogin;
    authTitle.textContent = isLogin ? 'Login' : 'Sign Up';
    document.getElementById('auth-submit').textContent = isLogin ? 'Login' : 'Sign Up';
    toggleAuthBtn.textContent = isLogin ? 'Need an account? Sign Up' : 'Have an account? Login';
    
    // Toggle visibility of signup fields
    signupFields.style.display = isLogin ? 'none' : 'block';
    document.getElementById('signup-name').required = !isLogin;
});

// Handle Auth Submit
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        if (isLogin) {
            // Check if trying to login as admin
            if (ADMIN_EMAILS_LIST.includes(email)) {
                alert("Admins must login via the Admin Portal.");
                return;
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            if (!userCredential.user.emailVerified) {
                alert("Please verify your email before logging in. Check your inbox.");
                await signOut(auth);
                return;
            }
        } else {
            const name = document.getElementById('signup-name').value;

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            // Save user profile
            await setDoc(doc(db, "users", userCredential.user.uid), {
                name: name,
                email: email
            });

            await sendEmailVerification(userCredential.user);
            alert("Account created! A verification email has been sent to " + email + ". Please verify before logging in. (Check your Spam folder if not found in Inbox)");
            await signOut(auth);
            // Switch to login view
            isLogin = true;
            authTitle.textContent = 'Login';
            document.getElementById('auth-submit').textContent = 'Login';
            toggleAuthBtn.textContent = 'Need an account? Sign Up';
            signupFields.style.display = 'none';
            document.getElementById('signup-name').required = false;
        }
    } catch (error) {
        console.error("Auth Error:", error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            alert("Incorrect email or password. Please try again.");
        } else {
            alert(error.message);
        }
    }
});

// Logout
logoutBtn.addEventListener('click', () => signOut(auth));

// Admin Access Control
const ADMIN_EMAILS = ["admin@municipality.com", "mukulguptaalw2006@gmail.com"]; // Add your admin emails here

// Pincode Lookup Logic
const pincodeInput = document.getElementById('pincode');
const pincodeMsg = document.getElementById('pincode-msg');
const cityInput = document.getElementById('city');
const stateInput = document.getElementById('state');

if (pincodeInput) {
    pincodeInput.addEventListener('input', async (e) => {
        const pincode = e.target.value;
        
        // Reset fields if pincode is cleared or invalid length
        if (pincode.length !== 6) {
            cityInput.value = '';
            stateInput.value = '';
            pincodeMsg.style.display = 'none';
            return;
        }

        // Valid length, fetch data
        pincodeMsg.textContent = "Searching...";
        pincodeMsg.style.display = 'block';
        pincodeMsg.style.color = 'var(--secondary-color)';

        try {
            const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = await response.json();

            if (data[0].Status === "Success") {
                const postOffice = data[0].PostOffice[0];
                cityInput.value = postOffice.District; // Or postOffice.Block or postOffice.Name
                stateInput.value = postOffice.State;
                pincodeMsg.textContent = "Location found!";
                pincodeMsg.style.color = 'var(--success-color)';
            } else {
                cityInput.value = '';
                stateInput.value = '';
                pincodeMsg.textContent = "Invalid Pincode";
                pincodeMsg.style.color = 'var(--danger-color)';
            }
        } catch (error) {
            console.error("Pincode API Error:", error);
            pincodeMsg.textContent = "Error fetching location";
            pincodeMsg.style.color = 'var(--danger-color)';
        }
    });
}

// Submit Grievance
grievanceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    // Check if user is admin
    if (ADMIN_EMAILS_LIST.includes(currentUser.email)) {
        alert("Admins cannot submit grievances. Please use a citizen account.");
        return;
    }

    const submitBtn = grievanceForm.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = "Analyzing & Submitting...";

    const fullName = document.getElementById('full-name').value;
    
    // Construct Address from new fields
    const doorNo = document.getElementById('door-no').value;
    const area = document.getElementById('area').value;
    const pincode = document.getElementById('pincode').value;
    const state = document.getElementById('state').value;
    const city = document.getElementById('city').value;
    
    if (!city || !state) {
        alert("Please enter a valid pincode to auto-fill City and State.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Grievance";
        return;
    }

    const address = `${doorNo}, ${area}, ${city}, ${state} - ${pincode}`;

    const municipality = document.getElementById('municipality').value;
    const category = document.getElementById('category').value;
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const photoFile = document.getElementById('grievance-photo').files[0];

    if (!photoFile) {
        alert("Please upload a photo of the grievance.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Grievance";
        return;
    }

    // Convert image to Base64
    const reader = new FileReader();
    reader.onloadend = async () => {
        const photoBase64 = reader.result;

        // Submit to Firestore immediately without waiting for AI
        try {
            const docRef = await addDoc(collection(db, "grievances"), {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                fullName,
                address,
                municipality,
                category,
                title,
                description,
                photo: photoBase64,
                status: "Pending",
                createdAt: new Date(),
                aiPriority: "Analyzing...", // Placeholder
                aiSummary: "Analyzing...", // Placeholder
                aiTags: [],
                verified: false
            });
            
            grievanceForm.reset();
            alert("Grievance submitted successfully! AI analysis is running in the background.");
            
            // Run AI Analysis in background and update the document
            analyzeGrievance(title, description, category, address).then(async (aiAnalysis) => {
                const priority = aiAnalysis.priority || "Medium";
                await updateDoc(doc(db, "grievances", docRef.id), {
                    aiPriority: priority,
                    aiSummary: aiAnalysis.summary || "No summary available",
                    aiTags: aiAnalysis.tags || [],
                    aiCause: aiAnalysis.cause || "Pending Analysis"
                });

                // Post to Social Feed (Community Voice)
                // Extract pincode from address string "Door, Area, City, State - Pincode"
                const pincodeMatch = address.match(/-\s*(\d{6})$/);
                const pincode = pincodeMatch ? pincodeMatch[1] : null;
                
                // Construct Public Address (without Door No) for grouping and privacy
                const publicAddress = `${area}, ${city}, ${state} - ${pincode}`;

                if (pincode) {
                    // Check for existing social post for this category, public address and pincode
                    const socialQ = query(collection(db, "social_posts"), 
                        where("category", "==", category),
                        where("publicAddress", "==", publicAddress),
                        where("pincode", "==", pincode),
                        where("aiGenerated", "==", true)
                    );
                    
                    const socialSnap = await getDocs(socialQ);
                    
                    if (!socialSnap.empty) {
                        // Update existing post counter
                        const postDoc = socialSnap.docs[0];
                        const currentCount = postDoc.data().reportCount || 1;
                        await updateDoc(doc(db, "social_posts", postDoc.id), {
                            reportCount: currentCount + 1,
                            lastUpdated: new Date()
                        });
                    } else {
                        // Create new social post
                        // Use publicAddress for the post content to hide door number
                        const postContent = await generateSocialPost({ 
                            title, 
                            description, 
                            municipality, 
                            address: publicAddress, 
                            category,
                            aiCause: aiAnalysis.cause 
                        });
                        await addDoc(collection(db, "social_posts"), {
                            content: postContent,
                            municipality: municipality,
                            category: category,
                            address: address, // Keep full address for admin reference if needed, or remove if strict privacy
                            publicAddress: publicAddress, // Store public address for grouping
                            pincode: pincode,
                            cause: aiAnalysis.cause || "Unknown",
                            createdAt: new Date(),
                            aiGenerated: true,
                            reportCount: 1
                        });
                    }

                    // Mark grievance as posted
                    await updateDoc(doc(db, "grievances", docRef.id), {
                        postedToSocial: true
                    });
                }

            }).catch(err => console.error("Background AI Analysis failed:", err));

        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Error submitting grievance: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Grievance";
        }
    };
    reader.readAsDataURL(photoFile);
});

// Load User Grievances
function loadUserGrievances() {
    if (!currentUser) return;

    // Removed orderBy("createdAt", "desc") to avoid needing a composite index for the MVP.
    // Sorting is done in JavaScript instead.
    const q = query(collection(db, "grievances"), where("userId", "==", currentUser.uid));
    
    onSnapshot(q, (snapshot) => {
        myGrievancesContainer.innerHTML = "";
        const grievances = [];
        snapshot.forEach((doc) => {
            grievances.push({ id: doc.id, ...doc.data() });
        });

        // Sort client-side
        grievances.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

        if (grievances.length === 0) {
            myGrievancesContainer.innerHTML = "<p>No grievances found.</p>";
            return;
        }

        grievances.forEach((data) => {
            const card = document.createElement('div');
            card.className = `card ${data.status === 'Resolved' ? 'resolved' : ''}`;
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span class="status-badge ${data.status === 'Pending' ? 'status-pending' : 'status-resolved'}">${data.status}</span>
                    <small>${new Date(data.createdAt.seconds * 1000).toLocaleDateString()}</small>
                </div>
                <h3>${data.title}</h3>
                <p>${data.description}</p>
                <p><strong>Municipality:</strong> ${data.municipality}</p>
                <p><strong>AI Priority:</strong> ${data.aiPriority}</p>
                <p><strong>Likely Cause:</strong> ${data.aiCause || 'Analyzing...'}</p>
                ${data.status === 'Resolved' && !data.verified ? 
                    `<div style="margin-top:10px; display:flex; gap:10px;">
                        <button onclick="verifyResolution('${data.id}')" style="background-color:#27ae60; flex:1;">✅ Verify Fixed</button>
                        <button onclick="reopenGrievance('${data.id}')" style="background-color:#e74c3c; flex:1;">❌ Not Fixed</button>
                     </div>` : 
                    (data.verified ? '<p style="color:green; font-weight:bold; margin-top:10px;">✅ Verified by you</p>' : '')}
            `;
            myGrievancesContainer.appendChild(card);
        });
    });
}

// Expose verify function to window
window.verifyResolution = async (id) => {
    console.log("Attempting to verify resolution for ID:", id);
    try {
        // Use the imported 'doc' and 'db' directly
        const grievanceRef = doc(db, "grievances", id);
        await updateDoc(grievanceRef, {
            verified: true
        });

        // Delete related social posts if any
        const grievanceSnap = await getDoc(grievanceRef);
        if (grievanceSnap.exists()) {
            const data = grievanceSnap.data();
            // Find social posts related to this municipality and category that were AI generated
            const q = query(collection(db, "social_posts"), 
                where("municipality", "==", data.municipality),
                where("category", "==", data.category),
                where("aiGenerated", "==", true)
            );
            
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(async (docSnap) => {
                const postData = docSnap.data();
                // Check if the post content mentions the title or description of the grievance to be more specific
                // This prevents deleting unrelated posts in the same category/municipality
                if (postData.content.includes(data.title) || postData.content.includes(data.description.substring(0, 20))) {
                     await deleteDoc(doc(db, "social_posts", docSnap.id));
                }
                // If the post mentions the location (address), that's a good signal.
                if (data.address && postData.content.includes(data.address.split(',')[0])) { // Check door no or street
                     await deleteDoc(doc(db, "social_posts", docSnap.id));
                }
            });
        }

        alert("Resolution verified! Thank you for your feedback.");
    } catch (error) {
        console.error("Error verifying:", error);
        alert("Error verifying resolution: " + error.message);
    }
};

window.reopenGrievance = async (id) => {
    if(confirm("Are you sure the issue is NOT fixed? This will send it back to the municipality.")) {
        try {
            const grievanceRef = doc(db, "grievances", id);
            await updateDoc(grievanceRef, {
                status: "Pending",
                verified: false,
                reopened: true
            });
            alert("Grievance reopened and sent back to Pending status.");
        } catch (error) {
            console.error("Error reopening:", error);
            alert("Error reopening grievance: " + error.message);
        }
    }
};
