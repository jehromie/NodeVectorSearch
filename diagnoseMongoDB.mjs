import { MongoClient } from "mongodb";
import "dotenv/config";

async function diagnoseConnection() {
  console.log("=== MongoDB Connection Diagnosis ===");
  
  // Check if environment variables are loaded
  console.log("1. Environment variables:");
  console.log("   NODE_ENV:", process.env.NODE_ENV);
  console.log("   OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✓ Set" : "✗ Missing");
  console.log("   MONGODB_ATLAS_URI:", process.env.MONGODB_ATLAS_URI ? "✓ Set" : "✗ Missing");
  
  if (!process.env.MONGODB_ATLAS_URI) {
    console.log("❌ MONGODB_ATLAS_URI is not set!");
    return;
  }
  
  // Parse the connection string to check components
  const uri = process.env.MONGODB_ATLAS_URI;
  console.log("\n2. Connection string analysis:");
  console.log("   Full URI:", uri);
  
  try {
    const url = new URL(uri.replace('mongodb+srv://', 'https://'));
    console.log("   Username:", url.username);
    console.log("   Password:", url.password ? "***" + url.password.slice(-4) : "Not found");
    console.log("   Host:", url.hostname);
    console.log("   Database params:", url.search);
  } catch (e) {
    console.log("   ❌ Could not parse URI:", e.message);
  }
  
  // Test connection with detailed error reporting
  console.log("\n3. Testing connection...");
  try {
    const client = new MongoClient(process.env.MONGODB_ATLAS_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    
    console.log("   Attempting to connect...");
    await client.connect();
    console.log("   ✅ Connection successful!");
    
    // Test admin command
    const admin = client.db().admin();
    const result = await admin.command({ hello: 1 });
    console.log("   ✅ Server response received");
    
    await client.close();
    console.log("   ✅ Connection closed cleanly");
    
  } catch (error) {
    console.log("   ❌ Connection failed:");
    console.log("   Error code:", error.code);
    console.log("   Error message:", error.message);
    
    if (error.message.includes("bad auth")) {
      console.log("\n🔧 Authentication Issue Detected:");
      console.log("   - Check username and password are correct");
      console.log("   - Ensure password doesn't contain special characters, or URL encode them");
      console.log("   - Verify the database user has proper permissions");
    }
    
    if (error.message.includes("ENOTFOUND") || error.message.includes("timeout")) {
      console.log("\n🔧 Network Issue Detected:");
      console.log("   - Check if your IP is whitelisted in MongoDB Atlas");
      console.log("   - Verify network connectivity");
    }
  }
}

diagnoseConnection();
