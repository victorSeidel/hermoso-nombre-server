import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import 
{ 
    CardToken, 
    MercadoPagoConfig, 
    Payment, 
    Preference
} from "mercadopago";

const app = express();

app.use(cors
({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const PORT = process.env.PORT;
app.listen(PORT, () => 
{
    console.log(`Server running on port ${PORT}`);
});

const pool = mysql.createPool
({
    host: "mysql50-farm1.kinghost.net",
    user: "hermosonombre",
    password: "abcdef1",
    database: "hermosonombre",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const client = new MercadoPagoConfig
({
    accessToken: "APP_USR-1059002744633799-032921-34478fa8fa9b03cf1447a35c87d443cd-60696263",
    options: 
    {
      timeout: 5000,
    },
});

const payment = new Payment(client);
const cardToken = new CardToken(client);
const preference = new Preference(client);

app.get("/", (req, res) => 
{
    res.send({ message: "Mercado Pago Integration"});
});

app.get("/preference", async (req, res) => 
{
    const preferenceBody = 
    {
        external_reference: crypto.randomUUID(),
        payer: { email: "test_user_123@testuser.com" },
        notification_url: "https://webhook.site/123-abc",
        items: 
        [
            {
                id: crypto.randomUUID(),
                currency_id: "BRL",
                title: "Product description",
                unit_price: Number(58.8),
                quantity: 1,
            },
        ],
    };

    try 
    {
        const response = await preference.create({ body: preferenceBody });
        res.send
        ({
            id: response.id,
            external_reference: response.external_reference,
            link: response.init_point,
        });
    } 
    catch (error) 
    {
        res.send({ error });
    }
});

app.get("/preference/:preferenceId", async (req, res) => 
{
    const { preferenceId } = req.params;
    try 
    {
        const response = await preference.get({ preferenceId });
        res.send
        ({
            id: response.id,
            external_reference: response.external_reference,
            link: response.init_point,
        });
    } 
    catch (error) 
    {
        res.send({ error });
    }
});

app.get("/payment", async (req, res) => 
{
    const token = await cardToken.create({ body: mockCreditCard });

    const paymentBody = 
    {
        description: "Cart description",
        external_reference: crypto.randomUUID(),
        installments: 1,
        notification_url: "https://webhook.site/123-abc",
        payer: { email: "test_user_123@testuser.com" },
        payment_type_id: "bank_transfer",
        payment_method_id: "master",
        token: token.id,
        transaction_amount: Number(58.8),
    };

    try 
    {
        const response = await payment.create({ body: paymentBody });
        res.send
        ({
            id: response.id,
            external_reference: response.external_reference,
            status: response.status,
            pix: response.point_of_interaction?.transaction_data?.ticket_url || 'N/A',
        });
    } 
    catch (error) 
    {
        res.send({ error });
    }
});

app.get("/payment/:id", async (req, res) => 
{
    const { id } = req.params;
    try 
    {
        const response = await payment.get({ id });
        res.send({
        id: response.id,
        external_reference: response.external_reference,
        status: response.status,
        pix: response.point_of_interaction?.transaction_data?.ticket_url || 'N/A',
        });
    } 
    catch (error) 
    {
        res.send({ error });
    }
});

app.post("/cancel_payment/:id", async (req, res) => 
{
    const { id } = req.params;
    try 
    {
        const response = await payment.cancel({ id });
        res.send(response);
    } 
    catch (error) 
    {
        res.send({ error });
    }
});

app.post("/notification", async (req, res) => 
{
    console.log({ message: "Notification received", body: req.body })
    // Info from req.body
    // {
    //   "action": "payment.created",
    //   "api_version": "v1",
    //   "data": {
    //     "id": "1323479563"
    //   },
    //   "date_created": "2024-05-28T20:42:45Z",
    //   "id": 113614395815,
    //   "live_mode": false,
    //   "type": "payment",
    //   "user_id": "234420836"
    // }
    res.send("OK");
});

app.get('/products', async (req, res) => 
{
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    try 
    {
        const [products] = await pool.query
        (
            'SELECT * FROM Produtos LIMIT ? OFFSET ?', 
            [limit, offset]
        );
        
        const [total] = await pool.query('SELECT COUNT(*) as count FROM Produtos');
        
        res.status(200).json
        ({
            products,
            total: total[0].count,
            page,
            totalPages: Math.ceil(total[0].count / limit)
        });
    } 
    catch (error) 
    {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

app.get('/products', async (req, res) => 
{
    const { category, minPrice, maxPrice, search } = req.query;
    let query = 'SELECT * FROM Produtos WHERE 1=1';
    const params = [];
    
    if (category) 
    {
        query += ' AND category = ?';
        params.push(category);
    }
    
    if (minPrice) 
    {
        query += ' AND unityPrice >= ?';
        params.push(parseFloat(minPrice));
    }
    
    if (maxPrice) 
    {
        query += ' AND unityPrice <= ?';
        params.push(parseFloat(maxPrice));
    }
    
    if (search) 
    {
        query += ' AND (title LIKE ? OR description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    
    try 
    {
        const [products] = await pool.query(query, params);
        res.status(200).json(products);
    } 
    catch (error) 
    {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

app.post('/cart', async (req, res) => 
{
    const { user_id, product_id, quantity } = req.body;
    
    try 
    {
        const [product] = await pool.query('SELECT * FROM Produtos WHERE id = ?', [product_id]);
        if (product.length === 0) 
        {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const [existingItem] = await pool.query
        (
            'SELECT * FROM Carrinho WHERE user_id = ? AND product_id = ?',
            [user_id, product_id]
        );

        if (existingItem.length > 0) 
        {
            await pool.query
            (
                'UPDATE Carrinho SET quantity = quantity + ? WHERE id = ?',
                [quantity || 1, existingItem[0].id]
            );
        } 
        else
        {
            await pool.query
            (
                'INSERT INTO Carrinho (user_id, product_id, quantity) VALUES (?, ?, ?)',
                [user_id, product_id, quantity || 1]
            );
        }

        res.status(200).json({ message: 'Item adicionado ao carrinho' });
    } 
    catch (error) 
    {
        console.error('Erro ao adicionar ao carrinho:', error);
        res.status(500).json({ error: 'Erro ao adicionar ao carrinho' });
    }
});

app.get('/cart/:user_id', async (req, res) => 
{
    const { user_id } = req.params;
    
    try 
    {
        const [items] = await pool.query
        (`
            SELECT c.*, p.name, p.unityPrice, (p.price * c.quantity) as subtotal
            FROM Carrinho c
            JOIN Produtos p ON c.product_id = p.id
            WHERE c.user_id = ?
        `, [user_id]);

        res.status(200).json(items);
    } 
    catch (error) 
    {
        console.error('Erro ao obter carrinho:', error);
        res.status(500).json({ error: 'Erro ao obter carrinho' });
    }
});

app.delete('/cart/:id', async (req, res) => 
{
    const { id } = req.params;
    
    try 
    {
        await pool.query('DELETE FROM Carrinho WHERE id = ?', [id]);
        res.status(204).send();
    } 
    catch (error) 
    {
        console.error('Erro ao remover do carrinho:', error);
        res.status(500).json({ error: 'Erro ao remover do carrinho' });
    }
});

app.put('/cart/:id', async (req, res) => 
{
    const { id } = req.params;
    const { quantity } = req.body;
    
    try 
    {
        await pool.query('UPDATE Carrinho SET quantity = ? WHERE id = ?', [quantity, id]);
        res.status(200).json({ message: 'Quantidade atualizada' });
    } 
    catch (error) 
    {
        console.error('Erro ao atualizar carrinho:', error);
        res.status(500).json({ error: 'Erro ao atualizar carrinho' });
    }
});
