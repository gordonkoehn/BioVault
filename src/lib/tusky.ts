 /** This file contains functions to interact with the Tusky API,
  *  For now, it only implements public vault functionality.
  */

import { Tusky } from "@tusky-io/ts-sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";

const username = "gordonkoehn"

const password = "your_password_here"

// Load environment variables from .env file
dotenv.config();

const APIKEY = process.env.TUSKY_API_KEY as string;
const VAULT_NAME = `BioVault_${username}`
let vaultId = "" // needs to be created with createVault first
const fileIds: string[] = [];

const createVault = async (client: Tusky) => {
    // create a public vault
    const response = await client.vault.create(VAULT_NAME, {encrypted: false});
    vaultId = response.id;
    console.log(response);
}

const uploadFile = async(client: Tusky, filePath: string) => {
    // Upload a file to the vault
    const fileId = await client.file.upload(vaultId, filePath);
    fileIds.push(fileId);
    console.log(`File uploaded successfully and got id: ${fileId}`);
    return fileId;
}

const readFile = async(client: Tusky, fileId: string) => {
    const response = await client.file.get(fileId);
    console.log (response)
    return response;
}

const main = async () => {
    const fileToUpload = "public/example_perscription_gordon.pdf"
    // Create a client
    const client = new Tusky({apiKey: APIKEY});

    // Create a vault
    await createVault(client);

    // Upload a file
    const fileId = await uploadFile(client, fileToUpload);

    // Read the file – write to file
    const file = await readFile(client, fileId);
    console.log(file);
}

// Call the main function and handle errors
main().catch(console.error);