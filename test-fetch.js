const run = async () => {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/cart/undefined');
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}
run();
