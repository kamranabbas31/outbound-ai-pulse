
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const VAPI_API_URL = "https://api.vapi.ai/call/phone";

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
    console.log("Starting trigger-call function");
    
    if (!VAPI_API_KEY) {
      console.error("VAPI_API_KEY is missing");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "VAPI_API_KEY is not configured" 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const { leadId } = await req.json();
    console.log("Processing lead ID:", leadId);
    
    // Get the Supabase client with admin privileges
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Supabase configuration is missing" 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // Initialize Supabase client
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    // Fetch the lead data
    console.log("Fetching lead data for ID:", leadId);
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();
    
    if (leadError) {
      console.error("Error fetching lead:", leadError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to fetch lead data",
          error: leadError 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    if (!lead) {
      console.error("Lead not found for ID:", leadId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Lead not found" 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    console.log("Lead found:", { id: lead.id, name: lead.name, status: lead.status, phone_id: lead.phone_id });
    
    // Check if lead has a phone_id assigned
    if (!lead.phone_id) {
      console.error("Lead does not have a phone_id assigned");
      return new Response(
        JSON.stringify({ 
          success: false,
          message: "This lead does not have a phone ID assigned"
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Check if lead call has already been initiated or completed
    if (lead.status !== "Pending") {
      console.error("Lead status is not Pending:", lead.status);
      return new Response(
        JSON.stringify({ 
          success: false,
          message: `This lead already has status: ${lead.status}. Cannot initiate another call.`
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Prepare the payload for Vapi
    const payload = {
      assistantId: "48b1e44a-c1ff-4f4e-a9e0-7b1e03f197ea",
      assistantOverrides: {
        variableValues: {
          Name: lead.name,
          Phone: lead.phone_number
        },
        metadata: {
          contactId: lead.id
        },
        voicemailDetection: {
          provider: "twilio",
          voicemailDetectionTypes: ["machine_end_beep"],
          enabled: true,
          machineDetectionTimeout: 30,
          machineDetectionSpeechThreshold: 2400,
          machineDetectionSpeechEndThreshold: 1800,
          machineDetectionSilenceTimeout: 5000
        },
        analysisPlan: {
          structuredDataPlan: {
            enabled: true
          },
          summaryPlan: {
            enabled: true
          },
          successEvaluationPlan: {
            enabled: true
          }
        }
      },
      phoneNumberId: lead.phone_id,
      customer: {
        name: lead.name,
        number: lead.phone_number
      }
    };

    console.log("Making request to Vapi API with payload:", JSON.stringify(payload, null, 2));
    
    // Make the API call to Vapi
    const response = await fetch(VAPI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VAPI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log("Vapi API response status:", response.status);
    console.log("Vapi API response headers:", Object.fromEntries(response.headers.entries()));
    
    const responseData = await response.json();
    console.log("Vapi API response data:", JSON.stringify(responseData, null, 2));
    
    // Update lead status in database
    if (response.ok) {
      console.log("Vapi API call successful, updating lead status");
      // Update lead status to "In Progress"
      const { error: updateError } = await supabaseAdmin
        .from("leads")
        .update({ 
          status: "In Progress",
          disposition: "Call initiated" 
        })
        .eq("id", leadId);
        
      if (updateError) {
        console.error("Error updating lead status:", updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Call initiated but failed to update lead status",
            error: updateError 
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
        
      console.log("Lead status updated successfully");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Call initiated successfully",
          data: responseData 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    } else {
      console.error("Vapi API call failed with status:", response.status);
      console.error("Vapi API error response:", responseData);
      
      // Update lead status to indicate failure
      const { error: updateError } = await supabaseAdmin
        .from("leads")
        .update({ 
          status: "Failed",
          disposition: `API Error: ${responseData.message || "Unknown error"}` 
        })
        .eq("id", leadId);
        
      if (updateError) {
        console.error("Error updating lead status after API failure:", updateError);
      }
        
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to initiate call",
          error: responseData 
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
  } catch (error) {
    console.error("Unexpected error in trigger-call function:", error);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Internal server error",
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
