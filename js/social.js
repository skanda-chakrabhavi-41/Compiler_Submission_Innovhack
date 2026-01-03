import { db, collection, query, orderBy, onSnapshot, where, getDocs, addDoc, updateDoc, doc } from './ai.js';
import { generateSocialPost } from './ai.js';

const socialFeed = document.getElementById('social-feed');

function loadSocialFeed() {
    const q = query(collection(db, "social_posts"), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        socialFeed.innerHTML = "";
        snapshot.forEach((doc) => {
            const data = doc.data();
            const post = document.createElement('div');
            post.className = 'post';
            
            // Display report count if greater than 1
            const countBadge = data.reportCount > 1 
                ? `<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 10px;">🔥 ${data.reportCount} Reports</span>` 
                : '';

            post.innerHTML = `
                <div class="post-header">
                    <div class="post-avatar"></div>
                    <div>
                        <strong>Citizen Grievance Bot</strong>
                        <div style="font-size: 0.8rem; color: #666;">${new Date(data.createdAt.seconds * 1000).toLocaleDateString()}</div>
                    </div>
                    ${data.aiGenerated ? '<span class="ai-badge">✨ AI Generated</span>' : ''}
                    ${countBadge}
                </div>
                <div class="post-content">
                    ${data.content.replace(/\n/g, '<br>')}
                </div>
            `;
            socialFeed.appendChild(post);
        });

        if (snapshot.empty) {
            socialFeed.innerHTML = "<p style='text-align:center'>No community updates yet.</p>";
        }
    });
}

loadSocialFeed();

// Auto-generate trending posts (Community Voice)
async function checkForTrendingUpdates() {
    console.log("Checking for trending updates...");
    try {
        // Query for potential trending issues
        // We want Pending, and NOT posted yet.
        const q = query(collection(db, "grievances"), 
            where("status", "==", "Pending")
        );
        
        const snapshot = await getDocs(q);
        const pendingHigh = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.postedToSocial) {
                pendingHigh.push({ id: doc.id, ...data });
            }
        });

        if (pendingHigh.length === 0) return;

        // Grouping by Category + Public Address (Area, City, State - Pincode)
        const groups = {};
        pendingHigh.forEach(g => {
            // Extract public address from full address "Door, Area, City, State - Pincode"
            // Assuming format is consistent. If not, fallback to full address.
            const parts = g.address.split(',').map(p => p.trim());
            let publicAddress = g.address;
            if (parts.length >= 4) {
                // Remove the first part (Door No)
                publicAddress = parts.slice(1).join(', ');
            }
            
            const key = `${g.category}-${publicAddress}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(g);
        });

        // Find a trending group (Threshold: 1 report)
        const trendingKey = Object.keys(groups).find(key => groups[key].length >= 1);

        if (trendingKey) {
            const group = groups[trendingKey];
            const representative = group[0]; 
            const count = group.length;

            // Reconstruct public address for the post
            const parts = representative.address.split(',').map(p => p.trim());
            let publicAddress = representative.address;
            if (parts.length >= 4) {
                publicAddress = parts.slice(1).join(', ');
            }

            console.log(`Found trending issue: ${trendingKey} with ${count} reports.`);

            // Generate post using public address to hide door number
            let postContent = await generateSocialPost({
                ...representative,
                address: publicAddress
            });
            
            if (count > 1) {
                postContent = `⚠️ TRENDING: ${count} reports in ${representative.municipality} regarding ${representative.category} near ${publicAddress}.\n\n` + postContent;
            }

            // Save to social_posts collection
            await addDoc(collection(db, "social_posts"), {
                content: postContent,
                municipality: representative.municipality,
                category: representative.category,
                address: representative.address, // Full address
                publicAddress: publicAddress,    // Public address for grouping
                createdAt: new Date(),
                aiGenerated: true,
                reportCount: count
            });

            // Mark ALL in this group as posted
            for (const g of group) {
                await updateDoc(doc(db, "grievances", g.id), {
                    postedToSocial: true
                });
            }
        }
    } catch (error) {
        console.error("Error checking trending updates:", error);
    }
}

// Run check on load and every 60 seconds
checkForTrendingUpdates();
setInterval(checkForTrendingUpdates, 60000);
