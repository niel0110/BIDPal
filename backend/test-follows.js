import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = `http://localhost:${process.env.PORT}/api`;

// This is a scratch test script. 
// In a real scenario, we'd use mock tokens or a test database.
// Since I cannot easily simulate user auth here without credentials, 
// I will just check if the routes are registered and responding.

async function test() {
  console.log('Testing Follows routes...');
  try {
    const res = await axios.get(`${API_URL}/follows/followers/some-uuid`);
    console.log('Followers route responding:', res.status);
  } catch (err) {
    console.log('Followers route (expectedly) failed or responded:', err.response?.status || err.message, err.response?.data);
  }

  try {
    const res = await axios.get(`${API_URL}/follows/following/some-uuid`);
    console.log('Following route responding:', res.status);
  } catch (err) {
    console.log('Following route (expectedly) failed or responded:', err.response?.status || err.message, err.response?.data);
  }

  console.log('Testing Messaging routes...');
  try {
    const res = await axios.get(`${API_URL}/messages`);
    console.log('Messages route responding:', res.status);
  } catch (err) {
    console.log('Messages route (expectedly) failed or responded:', err.response?.status || err.message, err.response?.data);
  }
}

test();
