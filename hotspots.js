// helium-hotspots plugin
// Print daily rewards amounts for your Helium Hotspots
// #antennalife

const request = require("request-promise-native");

const log = function (message) {
  console.log("helium-hotspots: " + message);
};

const httpGet = async function (url) {
  log(`GET ${url}`);
  let result = await request({
    url: url,
    method: "GET",
    json: true,
  });
  return result.data;
};

const fetchHotspotsForOwner = function (owner) {
  return httpGet(`https://api.helium.io/v1/accounts/${owner}/hotspots`);
};

const fetchRewardsForHotspot = function (address) {
  return httpGet(`https://api.helium.io/v1/hotspots/${address}/rewards${queryParams()}`);
};

const fetchRewardSumForHotspot = function (address, params) {
  return httpGet(`https://api.helium.io/v1/hotspots/${address}/rewards/sum${queryParams()}`);
};

const fetchActivityForHotspot = function (address, params) {
  return httpGet(`https://api.helium.io/v1/hotspots/${address}/activity${queryParams()}`);
};

const fetchHotspotDetails = function (address) {
  return httpGet(`https://api.helium.io/v1/hotspots/${address}`);
};

const formatDate = function (date) {
  // hard-set to midnight UTC on the date specified
  // return date.toISOString().substr(0, 10) + "T00:00:00Z";
  return date.toISOString();
};

const queryParams = function() {
  return `?${dateTimeParams()}`
}

const dateTimeParams = function () {
  const maxTime = new Date(Date.now()); // right now
  const minTime = new Date(Date.now() - 864e5);  // 24 hours ago
  return "max_time=" + formatDate(maxTime) + "&min_time=" + formatDate(minTime);
};

const listOwners = function () {
  if (!process.env.HOTSPOT_OWNERS) {
    return undefined;
  }

  const entries = process.env.HOTSPOT_OWNERS.split(",");
  const owners = new Map(entries.map(x => x.split(':')));
  return owners;
};

const listHotspots = function () {
  if (!process.env.HOTSPOTS) {
    return undefined;
  }

  const entries = process.env.HOTSPOTS.split(",");
  const hotspots = new Map(entries.map(x => x.split(':')));
  return hotspots;
};

const getOwnerForHotspot = function(ownerAddress, hotspotAddress) {
  if (listOwners() !== undefined) {
    return listOwners().get(ownerAddress);
  }
  else {
    return listHotspots().get(hotspotAddress);
  }
}

const fetchEverything = async function () {
  // abort if HOTSPOT_OWNERS is not set (see .env)
  if (listOwners() === undefined && listHotspots() === undefined) {
    log("helium-hotspots: HOTSPOT_OWNERS and HOTSPOTS are not set, please check your .env");
    return;
  }

  // fetch hotspots for our owners
  // TODO make this execute in parallel
  let hotspots = [];

  if (listOwners() !== undefined) {
    for (let owner of listOwners()) {
      let _hotspots = await fetchHotspotsForOwner(owner[0]);
      log(`Found ${_hotspots.length} hotspots for ${owner[0]} owned by ${owner[1]}`);
      hotspots = hotspots.concat(_hotspots);
    }
  }

  if (listHotspots() !== undefined) {
    for (let hotspot of listHotspots()) {
      let _hotspot = await fetchHotspotDetails(hotspot[0]);
      hotspots.push(_hotspot);
    }
  }

  // hydrate with reward and activity data
  // TODO make this execute in parallel
  for (let hotspot of hotspots) {
    let rewards = await fetchRewardSumForHotspot(hotspot["address"], dateTimeParams());
    // let rewards = {sum: 666};
    if (rewards["sum"] == null) { rewards["sum"] = 0; }
    hotspot["rewards_24h"] = (parseInt(rewards["sum"]) / 100000000);
  }

  // sort by reward amount
  hotspots = hotspots.sort(function (a, b) {
    if (a["rewards_24h"] > b["rewards_24h"]) return -1;
    if (a["rewards_24h"] < b["rewards_24h"]) return 1;
    return 0;
  });

  // build output
  let output = "";
  output += "```ml\n";

  for (let i = 0; i < hotspots.length; i++) {
    const hotspot = hotspots[i];
    const hnt = hotspot["rewards_24h"].toFixed(2);
    const ownerName = getOwnerForHotspot(hotspot["owner"], hotspot["address"]);
    output += `${hnt.toString().padEnd(7)} ${hotspot["name"].padEnd(25)}  @${ownerName}\n`;
      // `[x](https://explorer.helium.com/address/${hotspot["address"]}`
  }

  output += "```\n";
  return output;
};


module.exports = {
  fetchEverything,
};
