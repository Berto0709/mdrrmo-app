const { Client } = require('pg');

exports.handler = async (event, context) => {
    // 1. Connect to Neon Database
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Neon
    });

    try {
        await client.connect();

        // --- GET REQUEST: Fetch all activities ---
        if (event.httpMethod === 'GET') {
            const result = await client.query('SELECT * FROM activities ORDER BY start_date ASC');
            
            // Convert database rows to your app's format
            const activities = result.rows.map(row => ({
                id: row.id,
                section: row.section,
                // Handle date conversion if necessary
                start: row.start_date.toISOString().split('T')[0], 
                end: row.end_date.toISOString().split('T')[0],
                time: row.time_val,
                title: row.title,
                desc: row.description,
                status: row.status,
                photos: row.photos || [],
                pdfs: row.pdfs || []
            }));

            return {
                statusCode: 200,
                body: JSON.stringify(activities)
            };
        }

        // --- POST REQUEST: Save or Update activity ---
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            
            // Ensure photos/pdfs are arrays (fallback)
            const photos = data.photos || [];
            const pdfs = JSON.stringify(data.pdfs || []);

            let query = '';
            let values = [];

            if (data.id) {
                // UPDATE existing activity
                query = `
                    UPDATE activities 
                    SET section=$1, start_date=$2, end_date=$3, time_val=$4, title=$5, description=$6, status=$7, photos=$8, pdfs=$9
                    WHERE id=$10 RETURNING *`;
                values = [data.section, data.start, data.end, data.time, data.title, data.desc, data.status, photos, pdfs, data.id];
            } else {
                // INSERT new activity
                query = `
                    INSERT INTO activities (section, start_date, end_date, time_val, title, description, status, photos, pdfs)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
                values = [data.section, data.start, data.end, data.time, data.title, data.desc, data.status, photos, pdfs];
            }

            const res = await client.query(query, values);
            
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows[0])
            };
        }

        return { statusCode: 405, body: "Method Not Allowed" };

    } catch (error) {
        console.error('Database error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    } finally {
        await client.end();
    }
};