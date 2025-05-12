
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
    
    // Extract relevant data from payload
    const { contactId } = payload.metadata || {};
    const disposition = payload.disposition || "Unknown";
    const duration = payload.durationSeconds || 0;
    const cost = calculateCallCost(duration);
    const status = determineCallStatus(payload);
    
    // Update the lead in the database if we have a contactId
    if (contactId) {
      console.log(`Updating lead ${contactId} with status: ${status}, disposition: ${disposition}`);
      
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
    } else {
      console.warn("Webhook received without contactId in metadata");
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
          }).then(res => res.json()).then(data => ({ data: data[0], error: null }))
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
        }).then(res => ({ data: {}, error: null }))
      })
    })
  };
}
