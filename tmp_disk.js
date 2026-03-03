const fs = require('fs');
try {
    const stats = fs.statfsSync('d:\\\\artisans-compass');
    console.log('Total bytes:', stats.blocks * stats.bsize);
    console.log('Free bytes:', stats.bfree * stats.bsize);
} catch (e) {
    console.error(e);
}
