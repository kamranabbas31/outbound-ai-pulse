import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Define CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the webhook payload
    const payload = await req.json();
    console.log("Received webhook from Vapi:", JSON.stringify(payload, null, 2));

    // Get the Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Initialize Supabase client
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    // Try different methods to extract lead information
    let contactId = null;
    let phoneNumber = null;
    
    // Extract phone number from payload (try multiple paths)
    if (payload.customer && payload.customer.number) {
      phoneNumber = payload.customer.number;
      console.log(`Found phone number in payload.customer: ${phoneNumber}`);
    } else if (payload.message && 
               payload.message.artifact && 
               payload.message.artifact.customer && 
               payload.message.artifact.customer.number) {
      phoneNumber = payload.message.artifact.customer.number;
      console.log(`Found phone number in payload.message.artifact.customer: ${phoneNumber}`);
    }
    
    // Method 1: Check if contactId is in metadata
    if (payload.metadata && payload.metadata.contactId) {
      contactId = payload.metadata.contactId;
      console.log(`Found contactId in metadata: ${contactId}`);
    }
    // Method 2: Check if it's in assistantOverrides.metadata
    else if (payload.message && 
             payload.message.artifact && 
             payload.message.artifact.assistantOverrides && 
             payload.message.artifact.assistantOverrides.metadata && 
             payload.message.artifact.assistantOverrides.metadata.contactId) {
      contactId = payload.message.artifact.assistantOverrides.metadata.contactId;
      console.log(`Found contactId in artifact.assistantOverrides.metadata: ${contactId}`);
    }
    // Method 3: Look for phone number and find matching lead
    else if (phoneNumber) {
      console.log(`No contactId found, trying to find lead by phone number: ${phoneNumber}`);
      
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("id, phone_number")
        .eq("phone_number", phoneNumber)
        .limit(1);
        
      if (!error && data && data.length > 0) {
        contactId = data[0].id;
        console.log(`Found lead with phone number ${phoneNumber}, id: ${contactId}`);
      } else {
        console.log(`No lead found with phone number ${phoneNumber}`);
        // Try cleaning the phone number (remove any formatting) and try again
        const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');
        if (cleanedPhoneNumber !== phoneNumber) {
          const { data: data2, error: error2 } = await supabaseAdmin
            .from("leads")
            .select("id, phone_number")
            .ilike("phone_number", `%${cleanedPhoneNumber.slice(-10)}%`)
            .limit(1);
            
          if (!error2 && data2 && data2.length > 0) {
            contactId = data2[0].id;
            console.log(`Found lead with cleaned phone number ${cleanedPhoneNumber}, id: ${contactId}`);
          }
        }
      }
    }
    
    if (!contactId && !phoneNumber) {
      console.error("No contactId or phone number could be extracted from webhook payload");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to find contact information in webhook" 
        }),
        { 
          status: 200, // Still return 200 to acknowledge receipt
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Extract relevant data from payload
    let disposition = "Unknown";
    let duration = 0;
    let status = "Completed";
    
    // If payload includes analysis data, extract the disposition
    if (payload.message && payload.message.analysis && payload.message.analysis.successEvaluation) {
      try {
        // Try to parse the successEvaluation JSON string
        const evaluationData = JSON.parse(payload.message.analysis.successEvaluation);
        if (evaluationData && evaluationData.disposition) {
          disposition = evaluationData.disposition;
          console.log(`Extracted disposition from analysis: ${disposition}`);
        }
      } catch (e) {
        console.error("Error parsing successEvaluation JSON:", e);
        // Keep the raw string if it's not valid JSON
        disposition = payload.message.analysis.successEvaluation;
      }
    }
    
    // Extract call duration
    if (payload.durationSeconds) {
      duration = payload.durationSeconds;
      console.log(`Extracted duration from payload.durationSeconds: ${duration}`);
    } else if (payload.message && payload.message.durationSeconds) {
      duration = payload.message.durationSeconds;
      console.log(`Extracted duration from payload.message.durationSeconds: ${duration}`);
    }
    
    // Calculate cost based on duration (in minutes)
    // $0.99 per minute, converting seconds to minutes
    const durationMinutes = duration / 60;
    const cost = durationMinutes * 0.99;
    console.log(`Calculated cost: $${cost.toFixed(2)} for ${durationMinutes.toFixed(1)} minutes`);
    
    // Determine call status
    if (payload.success === false || (payload.message && payload.message.success === false)) {
      status = "Failed";
      console.log("Call status determined as Failed");
    } else {
      console.log("Call status determined as Completed");
    }
    
    // Update the lead in the database if we have a contactId
    if (contactId) {
      console.log(`Updating lead ${contactId} with status: ${status}, disposition: ${disposition}, duration: ${duration}, cost: ${cost}`);
      
      const { data, error } = await supabaseAdmin
        .from("leads")
        .update({
          status,
          disposition,
          duration: durationMinutes, // Store as minutes
          cost
        })
        .eq("id", contactId)
        .select();
      
      if (error) {
        console.error("Error updating lead:", error);
        return new Response(
          JSON.stringify({ success: false, message: "Failed to update lead", error: error.message }),
          { 
            status: 200, // Still return 200 to acknowledge receipt
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      console.log(`Successfully updated lead ${contactId}:`, data);
    } else {
      console.warn("Webhook received without contactId and couldn't find matching lead");
      // Still return a success to acknowledge receipt
    }
    
    // Always return a success to Vapi
    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed successfully" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Failed to process webhook",
        error: error.message 
      }),
      { 
        status: 200, // Still return 200 so Vapi doesn't retry
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Helper function to calculate call cost
function calculateCallCost(durationSeconds: number): number {
  // $0.99 per minute
  const minuteRate = 0.99;
  const minutes = durationSeconds / 60;
  return minutes * minuteRate;
}

// Helper to create a Supabase client (copied from trigger-call edge function)
function createClient(supabaseUrl: string, supabaseKey: string) {
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: any) => ({
          single: () => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json"
            }
          }).then(res => res.json()).then(data => ({ data: data[0], error: null })),
          limit: (n: number) => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${value}&limit=${n}`, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json"
            }
          }).then(res => res.json()).then(data => ({ data, error: null })),
        }),
        ilike: (column: string, value: any) => ({
          limit: (n: number) => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=ilike.${value}&limit=${n}`, {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json"
            }
          }).then(res => res.json()).then(data => ({ data, error: null }))
        }),
        single: () => fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}`, {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json"
          }
        }).then(res => res.json()).then(data => ({ data: data[0], error: null }))
      }),
      update: (updates: any) => ({
        eq: (column: string, value: any) => ({
          select: () => fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
            method: "PATCH",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=representation"
            },
            body: JSON.stringify(updates)
          })
          .then(res => {
            if (res.status === 204) {
              return { data: {}, error: null };
            }
            return res.json()
              .then(data => ({ data, error: null }))
              .catch(err => ({ data: null, error: err }));
          })
          .catch(err => ({ data: null, error: err }))
        })
      })
    })
  };
}
