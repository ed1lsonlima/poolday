import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metodo nao permitido' });
    }

      try {
      const { bookingId, amount, title, email } = req.body;

      const preference = new Preference(client);
          const result = await preference.create({
                body: {
                    items: [
                        {
                            id: bookingId,
                            title: title,
                            quantity: 1,
                unit_price: Math.round(Number(amount) * 100) / 100,
              }
            ],
            payer: { email },
                    back_urls: {
                        success: 'https://poolday-self.vercel.app/reservas',
                        failure: 'https://poolday-self.vercel.app/explorar',
              pending: 'https://poolday-self.vercel.app/reservas'
            },
                    external_reference: bookingId,
                    notification_url: 'https://poolday-self.vercel.app/api/webhook',
                    auto_return: 'approved'
          }
          });

      res.status(200).json({ init_point: result.init_point });
      } catch (error) {
      console.error('Erro ao criar preferencia:', error);
      res.status(500).json({ error: 'Erro ao processar pagamento' });
    }
  }
    
