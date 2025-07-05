# Walrus-Agent Integration TODO List

## Overview
Connect the existing Walrus/Tusky frontend integration with the Python agents that are already built and tested.

## Current State Summary

### ✅ Already Implemented:
- **Frontend**: Walrus file upload via Tusky (`uploadFileObject()` in `/lib/tusky.ts`)
- **Frontend**: Vault creation and management (`/lib/vault.ts`, `/lib/tuskyClient.ts`)
- **Agents**: Complete Python agent system with Claude, GPT-4, and ASI1 adapters
- **Agents**: Multi-agent consensus orchestrator
- **Agents**: PDF processing with Fernet encryption support
- **Testing**: Working test suite with test PDFs
- **API**: Existing TypeScript API endpoints for vault operations (`/api/vault/*`)

### 🔄 Gap to Bridge:
- Frontend has Walrus file IDs
- Agents expect local file paths
- Need to connect these two systems

## 1. Create Python Serverless Bridge

### Create `/api/evaluate_claim.py`
- [ ] Import existing agent code from `/src/agents/`
- [ ] Reuse `NLPPolicyAgent`, `ClaudeLLMAdapter`, `GPT4LLMAdapter`, `ASI1LLMAdapter`
- [ ] Import existing schemas from `src/agents/schemas.py`
- [ ] Use existing `AgentVerdict` and other models

### Implementation:
```python
# Leverage existing code
from src.agents.nlp_policy_agent import NLPPolicyAgent
from src.agents.distributed_orchestrator import DistributedConsensusOrchestrator
from src.agents.schemas import ClaimEvaluationRequest, AgentVerdict
```

## 2. Integrate with Existing Tusky Client

### Add File Download to Python Handler
- [ ] Call existing Tusky API endpoint: `GET /api/vault/file?fileId={fileId}`
- [ ] Use the same API that frontend already uses
- [ ] Leverage existing `getFile()` from `tuskyClient.ts` pattern

### Example:
```python
async def download_from_tusky(file_id: str) -> bytes:
    # Use existing Tusky API
    response = await fetch(f"{VERCEL_URL}/api/vault/file?fileId={file_id}")
    return await response.read()
```

## 3. Reuse Existing Agent Configuration

### Use Existing Environment Variables
- [ ] `ANTHROPIC_API_KEY` - already in `.env.local`
- [ ] `OPENAI_API_KEY` - already in `.env.local`
- [ ] `ASI_API_KEY` - already in `.env.local`
- [ ] No new env vars needed!

### Use Existing Agent Initialization
- [ ] Copy initialization pattern from `test_run_agents.py`
- [ ] Reuse the three agent setup (Claude, GPT-4, ASI1)
- [ ] Use same ports and configuration

## 4. Minimal Frontend Changes

### Update Claim Submission (`/app/submit-claim/page.tsx`)
- [ ] After line 63 where `tuskyFileId` is stored, add API call:
```javascript
// Existing code saves tuskyFileId
// Add evaluation call
const evaluation = await fetch('/api/evaluate_claim', {
  method: 'POST',
  body: JSON.stringify({
    policy_walrus_id: policyFileId,
    invoice_walrus_id: invoiceFileId,
    vault_id: getUserVaultId()
  })
})
```

### Update Insurance Dashboard (`/app/insurance/page.tsx`)
- [ ] Display evaluation results from agents
- [ ] Show consensus verdict
- [ ] Use existing `SubmittedFile` interface

## 5. Adapt Existing Test Setup

### Reuse Test Infrastructure
- [ ] Use logic from `test_run_agents.py` for agent initialization
- [ ] Remove test PDF creation - use Walrus files instead
- [ ] Keep the same multi-agent consensus logic

### Simplified Flow:
```python
# Instead of test PDFs
policy_path = await download_and_save_temp(policy_walrus_id)
invoice_path = await download_and_save_temp(invoice_walrus_id)

# Use existing evaluation logic
verdict = await agent.evaluate_claim(
    policy_path=policy_path,
    invoice_path=invoice_path,
    decryption_key="test_key_for_unencrypted_pdfs_32c",  # From existing code
    claim_id=claim_id
)
```

## 6. Leverage Existing Infrastructure

### Use Existing Message Types
- [ ] No changes needed to `agent_messages.py`
- [ ] `ClaimEvaluationMessage` stays the same
- [ ] Agents don't need to know about Walrus

### Use Existing Orchestrator Pattern
- [ ] Optional: Run consensus in serverless
- [ ] Or: Run single agent evaluation per request
- [ ] Reuse consensus logic from `distributed_orchestrator.py`

## 7. Minimal New Code Required

### New Files:
- [ ] `/api/evaluate_claim.py` - Main serverless handler
- [ ] `/requirements.txt` - Copy from existing, remove test dependencies

### Updated Files:
- [ ] `/app/submit-claim/page.tsx` - Add evaluation API call
- [ ] `/app/insurance/page.tsx` - Show results
- [ ] `/vercel.json` - Add Python function config

## 8. Deployment Configuration

### Vercel Setup (Building on Existing):
```json
{
  "functions": {
    "api/evaluate_claim.py": {
      "runtime": "python3.9",
      "maxDuration": 60
    }
  }
}
```

### Use Existing Requirements:
- [ ] Copy from `src/agents/requirements.txt`
- [ ] Remove testing libraries (pytest, etc.)
- [ ] Keep all agent dependencies

## 9. Testing Strategy

### Adapt Existing Tests:
- [ ] Upload test PDFs to Walrus first
- [ ] Get file IDs
- [ ] Call Python API with those IDs
- [ ] Verify same results as local tests

## Implementation Steps

### Phase 1: Basic Connection (1-2 hours)
1. Create `/api/evaluate_claim.py` with single agent
2. Test with existing test PDFs uploaded to Walrus
3. Verify agent receives and processes files

### Phase 2: Full Integration (2-3 hours)
1. Add multi-agent support
2. Integrate with frontend claim submission
3. Display results in dashboard

### Phase 3: Production Ready (2-3 hours)
1. Add proper error handling
2. Implement request queuing if needed
3. Add monitoring and logging

## Key Advantages of This Approach

1. **Minimal New Code**: Reuses 90% of existing code
2. **No Agent Changes**: Agents work exactly as tested
3. **Simple Bridge**: Python handler is just a thin wrapper
4. **Proven Components**: All pieces already work independently
5. **Easy Testing**: Can test with existing test suite

## Success Metrics

- [ ] Zero changes to agent code required
- [ ] Frontend changes < 50 lines
- [ ] Python handler < 200 lines
- [ ] Uses all existing API keys and configs
- [ ] Maintains existing test coverage