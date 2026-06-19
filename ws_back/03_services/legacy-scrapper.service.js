const axios = require("axios");

const scraperBaseUrl = (process.env.SCRAPER_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const scraperAuth = process.env.SCRAPER_USER && process.env.SCRAPER_PASSWORD
  ? {
      username: process.env.SCRAPER_USER,
      password: process.env.SCRAPER_PASSWORD,
    }
  : undefined;

function toServiceError(error) {
  const serviceError = new Error(error.response?.data?.error || error.message || "legacy scrapper error");
  serviceError.status = error.response?.status || 500;
  return serviceError;
}

async function viewScrapper(id) {
  try {
    const response = await axios.get(`${scraperBaseUrl}/scrape/${id}`, {
      auth: scraperAuth,
      timeout: 120000,
    });
    return response.data;
  } catch (error) {
    throw toServiceError(error);
  }
}

async function runScrapper(id) {
  try {
    const response = await axios.get(`${scraperBaseUrl}/run/${id}`, {
      auth: scraperAuth,
      timeout: 120000,
    });
    return response.data;
  } catch (error) {
    throw toServiceError(error);
  }
}

module.exports = {
  viewScrapper,
  runScrapper,
};
