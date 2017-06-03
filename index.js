let nodeVersion = 6;

if(process.version.slice(1, 2) > 6) {
  nodeVersion = 7;
  process.env.v7 = true;
}

module.exports = require(`./versions/Node-v${nodeVersion}/soas2`);
