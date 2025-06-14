
import * as XLSX from 'xlsx';
import { fetchLeadsForCampaign } from '@/services/campaignService';

export interface CampaignReportData {
  campaignName: string;
  leads: any[];
}

export const generateCampaignReport = async (campaignId: string, campaignName: string) => {
  try {
    // Fetch all leads for the campaign
    const leads = await fetchLeadsForCampaign(campaignId);
    
    if (!leads || leads.length === 0) {
      throw new Error('No leads found for this campaign');
    }
    
    // Prepare data for Excel export
    const reportData = leads.map((lead, index) => ({
      'S.No': index + 1,
      'Name': lead.name || '',
      'Phone Number': lead.phone_number || '',
      'Status': lead.status || '',
      'Disposition': lead.disposition || 'N/A',
      'Duration (minutes)': lead.duration ? (lead.duration / 60).toFixed(2) : '0.00',
      'Cost ($)': lead.cost ? lead.cost.toFixed(2) : '0.00'
    }));
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    
    // Set column widths for better readability
    const columnWidths = [
      { wch: 8 },   // S.No
      { wch: 20 },  // Name
      { wch: 15 },  // Phone Number
      { wch: 12 },  // Status
      { wch: 15 },  // Disposition
      { wch: 18 },  // Duration
      { wch: 12 }   // Cost
    ];
    worksheet['!cols'] = columnWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Campaign Report');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${campaignName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${timestamp}.xlsx`;
    
    // Write and download file
    XLSX.writeFile(workbook, filename);
    
    return true;
  } catch (error) {
    console.error('Error generating campaign report:', error);
    throw error;
  }
};
