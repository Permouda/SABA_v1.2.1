import {Webhook} from 'svix'
import { headers } from 'next/headers'
import { verifyWebhook, WebhookEvent } from '@clerk/nextjs/webhooks'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
    const SIGNING_SECRET=process.env.CLERK_SIGNING_SECRET

    if(!SIGNING_SECRET){
        throw new Error('Error: Please add SIGNING_SECRET from Clerk to .env')
    }

    const wh = new Webhook(SIGNING_SECRET)

    const headerPayload = await headers()
    const svix_id = headerPayload.get('svix-id') 
    const svix_timestamp = headerPayload.get('svix-timestamp')
    const svix_signature = headerPayload.get('svix-signature')

    if(!svix_id || !svix_timestamp || !svix_signature){
        return new Response('Error: Missing Svix headers', {
            status: 400,
        })
    }


    const payload = await req.json()
    const body = JSON.stringify(payload)

    let evt: WebhookEvent

    try {
        evt = wh.verify(body, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature':svix_signature,
        })as WebhookEvent
    } catch (err) {
        console.error('Error: Culd not verify webhook', err)
        return new Response('Errorr: Verification error', {
            status: 400,
        })
    }

    // Do something with payload
    // For this guide, log payload to console
    const eventType = evt.type
    // console.log(`Received webhook with ID ${data.id} and event type of ${eventType}`)
    // console.log('Webhook payload:', evt.data)
    
    
    if (eventType === "user.created"){
        const { data } = evt
        await db.insert(users).values({
            clerkId: data.id,
            name: `${data.first_name} ${data.last_name}`,
            imageUrl: data.image_url,
        })
    }

    if (eventType === "user.deleted"){
        const {data} = evt;
        
        if (!data.id){
            return new Response("Missing user id", {status:400})
        }
        
        await db.delete(users).where(eq(users.clerkId, data.id))
    }

    if (eventType === "user.updated"){
        const {data} = evt;

        await db 
        .update(users)
        .set({
            name: `${data.first_name} ${data.last_name}`,
            imageUrl: data.image_url,
        })
        .where(eq(users.clerkId, data.id));
    }

    return new Response('Webhook received', { status: 200 })    


//   try {
//     const evt = await verifyWebhook(req)

//     // Do something with payload
//     // For this guide, log payload to console
//     const { id } = evt.data
//     const eventType = evt.type
//     console.log(`Received webhook with ID ${id} and event type of ${eventType}`)
//     console.log('Webhook payload:', evt.data)

//     return new Response('Webhook received', { status: 200 })
//   } catch (err) {
//     console.error('Error verifying webhook:', err)
//     return new Response('Error verifying webhook', { status: 400 })
//   }
}