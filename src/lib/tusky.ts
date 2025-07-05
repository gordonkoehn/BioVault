import { getUserVaultId } from "./vault";
import { uploadFile as apiUploadFile, uploadFileObject as apiUploadFileObject, getFile as apiGetFile, listFiles as apiListFiles } from "./tuskyClient";

// Keep track of uploaded file IDs for this session
const fileIds: string[] = [];

/**
 * Upload a file to the user's vault using file path
 */
const uploadFile = async (filePath: string) => {
    const vaultId = getUserVaultId();
    if (!vaultId) {
        throw new Error('No vault found. Please login first.');
    }
    
    const response = await apiUploadFile(vaultId, filePath);
    
    if (response.success && response.fileId) {
        fileIds.push(response.fileId);
        console.log(`File uploaded successfully and got id: ${response.fileId}`);
        return response.fileId;
    } else {
        throw new Error(response.error || 'Failed to upload file');
    }
}

/**
 * Upload a File object to the user's vault
 */
const uploadFileObject = async (file: File) => {
    const vaultId = getUserVaultId();
    if (!vaultId) {
        throw new Error('No vault found. Please login first.');
    }
    
    const response = await apiUploadFileObject(vaultId, file);
    
    if (response.success && response.fileId) {
        fileIds.push(response.fileId);
        console.log(`File uploaded successfully and got id: ${response.fileId}`);
        return response.fileId;
    } else {
        throw new Error(response.error || 'Failed to upload file');
    }
}

/**
 * Read a file that was previously uploaded
 */
const readFile = async () => {
    if (fileIds.length > 0) {
        const response = await apiGetFile(fileIds[0]);
        
        if (response.success) {
            console.log('File retrieved:', response.file);
            return response.file;
        } else {
            throw new Error(response.error || 'Failed to get file');
        }
    } else {
        console.log('No files have been uploaded yet.');
        return null;
    }
}

/**
 * List all files in the user's vault
 */
const listFiles = async () => {
    const vaultId = getUserVaultId();
    if (!vaultId) {
        throw new Error('No vault found. Please login first.');
    }
    
    const response = await apiListFiles(vaultId);
    
    if (response.success && response.items) {
        console.log('\n=== Files in vault ===');
        console.log(`Found ${response.items.length} files:`);
        response.items.forEach((file, index) => {
            console.log(`${index + 1}. ${file.name} (ID: ${file.id}, Size: ${file.size} bytes)`);
        });
        return response.items;
    } else {
        throw new Error(response.error || 'Failed to list files');
    }
}

/**
 * Example usage function
 */
const main = async () => {
    try {
        const fileToUpload = "../images/walrus1.jpg"

        // Check if vault exists
        const vaultId = getUserVaultId();
        if (!vaultId) {
            console.error('No vault found. Please login first to create a vault.');
            return;
        }

        console.log(`Using vault: ${vaultId}`);

        // Upload a file
        await uploadFile(fileToUpload);

        // Read the file
        await readFile();

    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Export functions for use in other parts of the application
export { uploadFile, uploadFileObject, readFile, listFiles, main };

// Only run main if this file is executed directly (not imported)
if (typeof window !== 'undefined') {
    // This is running in the browser, you can call main() if needed
    // main().catch(console.error);
}
