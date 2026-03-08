import { supabase } from './config/supabase.js'

async function testConnection() {
    console.log('Testing Supabase connection...')
    console.log('URL:', process.env.SUPABASE_URL)

    try {
        const { data, error } = await supabase.from('User').select('count', { count: 'exact', head: true })
        if (error) {
            console.error('Connection failed:', error.message)
        } else {
            console.log('Connection successful! User count:', data)
        }
    } catch (err) {
        console.error('Unexpected error:', err.message)
        if (err.cause) {
            console.error('Cause:', err.cause)
        }
    }
}

testConnection()
