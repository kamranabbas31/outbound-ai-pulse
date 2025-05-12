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
    // Method 3: Look for phone number in customer data and find matching lead
    else if (payload.customer && payload.customer.number) {
      const phoneNumber = payload.customer.number;
      console.log(`No contactId found, trying to find lead by phone number: ${phoneNumber}`);
      
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("phone_number", phoneNumber)
        .limit(1);
        
      if (!error && data && data.length > 0) {
        contactId = data[0].id;
        console.log(`Found lead with phone number ${phoneNumber}, id: ${contactId}`);
      }
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
    } else if (payload.message && payload.message.durationSeconds) {
      duration = payload.message.durationSeconds;
    }
    
    // Calculate cost based on duration
    const cost = calculateCallCost(duration);
    
    // Determine call status
    if (payload.success === false || (payload.message && payload.message.success === false)) {
      status = "Failed";
    }
    
    // Update the lead in the database if we have a contactId
    if (contactId) {
      console.log(`Updating lead ${contactId} with status: ${status}, disposition: ${disposition}, duration: ${duration}, cost: ${cost}`);
      
      const { error } = await supabaseAdmin
        .from("leads")
        .update({
          status,
          disposition,
          duration,
          cost
        })
        .eq("id", contactId);
      
      if (error) {
        console.error("Error updating lead:", error);
        return new Response(
          JSON.stringify({ success: false, message: "Failed to update lead" }),
          { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      console.log(`Successfully updated lead ${contactId}`);
    } else {
      console.warn("Webhook received without contactId and couldn't find matching lead");
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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Helper function to determine call status based on webhook payload
function determineCallStatus(payload: any): string {
  // Check if the call was completed successfully
  if (payload.success === true || payload.outcome === "success") {
    return "Completed";
  }
  
  // Check various failure conditions
  if (payload.outcome === "failed" || payload.success === false) {
    return "Failed";
  }
  
  // Default to a generic status if we can't determine
  return "Completed";
}

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
        eq: (column: string, value: any) => fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
          method: "PATCH",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(updates)
        }).then(res => res.status === 204 ? { data: {}, error: null } : { data: null, error: { message: "Failed to update" } })
      })
    })
  };
}
