
export const parseCSV = (content: string): { name: string, phoneNumber: string }[] => {
  const lines = content.split('\n');
  
  // Find header row
  const headers = lines[0].split(',').map(header => header.trim().toLowerCase());
  const nameIndex = headers.findIndex(header => 
    header === 'name' || header === 'lead name' || header.includes('name'));
  const phoneIndex = headers.findIndex(header => 
    header === 'phone' || header === 'phone number' || header.includes('phone'));
  
  if (nameIndex === -1 || phoneIndex === -1) {
    throw new Error('CSV must include columns for Name and Phone Number');
  }
  
  // Parse data rows
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      const values = line.split(',');
      if (values.length >= Math.max(nameIndex, phoneIndex) + 1) {
        const name = values[nameIndex].trim();
        const phoneNumber = values[phoneIndex].trim();
        if (name && phoneNumber) {
          results.push({ name, phoneNumber });
        }
      }
    }
  }
  
  return results;
};
