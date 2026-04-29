const http = require('http');

http.get('http://localhost:3000/?sort=recent', (res) => {
    let data = '';
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Body:', data);
    });
}).on('error', (err) => {
    console.log('Error:', err.message);
});
