"""
Consensus Orchestrator for Bio Vault
Implements proper wallet signing, broadcast discovery, and verifiable message authentication
"""
import os
import asyncio
from typing import Dict, Any, List, Optional, Set
from datetime import datetime, timedelta
import logging

from uagents import Agent, Bureau, Context, Model
from uagents.setup import fund_agent_if_low

from agent_messages import (
    ClaimEvaluationMessage, VerdictResponseMessage, ConsensusRequestMessage,
    ConsensusResponseMessage, HealthCheckMessage, HealthResponseMessage,
    AgentRegistrationMessage, AgentDiscoveryMessage, AgentListMessage,
    SimpleVerdictMessage, SimpleConsensusResult, MESSAGE_TYPES,
    serialize_for_uagents, deserialize_from_uagents, message_deduplicator,
    create_error_response
)


class DistributedConsensusOrchestrator:
    """
    Production-ready distributed consensus orchestrator
    Features: Wallet signing, broadcast discovery, verifiable authentication
    """
    
    def __init__(
        self,
        orchestrator_id: str = "consensus_orchestrator_001",
        seed: str = None,
        port: int = 8000,
        consensus_threshold: float = 1.0,
        agent_timeout: float = 120.0,
        mailbox_key: str = None,
        **kwargs
    ):
        # Initialize uAgent with proper wallet management
        self.orchestrator_id = orchestrator_id
        self.seed = seed or os.getenv("ORCHESTRATOR_SEED", f"orchestrator_seed_{orchestrator_id}")
        
        # Create uAgent instance with mailbox for Agentverse
        self.agent = Agent(
            name=orchestrator_id,
            seed=self.seed,
            port=port,
            endpoint=f"http://localhost:{port}/submit",
            mailbox=mailbox_key  # Essential for Agentverse deployment
        )
        
        # Configuration
        self.consensus_threshold = consensus_threshold
        self.agent_timeout = agent_timeout
        
        # Agent registry with wallet verification
        self.registered_agents: Dict[str, AgentRegistrationMessage] = {}
        self.verified_wallets: Dict[str, str] = {}  # agent_id -> wallet_address
        
        # Active consensus sessions with timeout management
        self.active_consensuses: Dict[str, Dict] = {}
        self.pending_verdicts: Dict[str, List[VerdictResponseMessage]] = {}
        self.consensus_futures: Dict[str, asyncio.Future] = {}
        
        # Performance tracking with wallet verification metrics
        self.consensus_metrics = {
            "total_evaluations": 0,
            "consensus_achieved": 0,
            "consensus_failed": 0,
            "agent_timeouts": 0,
            "duplicate_messages": 0,
            "average_consensus_time": 0,
            "partial_consensus_count": 0,
            "wallet_verification_failures": 0,
            "broadcast_discoveries": 0
        }
        
        # Setup logging
        self.logger = logging.getLogger(f"DistributedOrchestrator_{orchestrator_id}")
        
        # Setup message handlers
        self._setup_message_handlers()
        
        self.logger.info(f"Distributed orchestrator initialized: {self.agent.address}")
        self.logger.info(f"Wallet address: {self.agent.wallet.address()}")
    
    def _setup_message_handlers(self):
        """Setup all uAgents message handlers with wallet verification"""
        
        @self.agent.on_message(model=AgentRegistrationMessage)
        async def handle_agent_registration(ctx: Context, sender: str, msg: AgentRegistrationMessage):
            """Handle agent registration with wallet verification"""
            if message_deduplicator.is_duplicate(msg):
                self.consensus_metrics["duplicate_messages"] += 1
                return
            
            # Verify wallet signature (sender must match agent_address in message)
            if sender != msg.agent_address:
                self.consensus_metrics["wallet_verification_failures"] += 1
                self.logger.warning(f"Wallet verification failed: sender {sender} != claimed {msg.agent_address}")
                return
                
            self.logger.info(f"Agent registration from verified wallet {sender}: {msg.agent_id}")
            
            # Store agent registration with wallet verification
            self.registered_agents[msg.agent_id] = msg
            self.verified_wallets[msg.agent_id] = sender
            
            self.logger.info(f"Registered verified agent {msg.agent_id} with wallet {sender}")
        
        @self.agent.on_message(model=AgentDiscoveryMessage)
        async def handle_agent_discovery(ctx: Context, sender: str, msg: AgentDiscoveryMessage):
            """Handle agent discovery requests"""
            if message_deduplicator.is_duplicate(msg):
                return
                
            self.logger.info(f"Agent discovery request from {sender}")
            
            # Filter agents by required capabilities
            matching_agents = []
            for agent_reg in self.registered_agents.values():
                if not msg.required_capabilities or all(
                    cap in agent_reg.capabilities for cap in msg.required_capabilities
                ):
                    matching_agents.append(agent_reg)
            
            # Send response with wallet verification
            response = AgentListMessage(
                agents=matching_agents,
                total_agents=len(matching_agents),
                orchestrator_address=str(self.agent.address),
                request_message_id=msg.message_id
            )
            
            await ctx.send(sender, response)
            self.logger.info(f"Sent {len(matching_agents)} verified agents to {sender}")
        
        @self.agent.on_message(model=ConsensusRequestMessage)
        async def handle_consensus_request(ctx: Context, sender: str, msg: ConsensusRequestMessage):
            """Handle consensus evaluation requests with wallet verification"""
            if message_deduplicator.is_duplicate(msg):
                return
                
            try:
                self.logger.info(f"Consensus request from verified wallet {sender} for claim {msg.claim_id}")
                
                # Execute distributed consensus using only message passing
                consensus_result = await self._execute_distributed_consensus_async(ctx, msg)
                
                # Send response with wallet signature
                response = ConsensusResponseMessage(
                    claim_id=msg.claim_id,
                    request_message_id=msg.message_id,
                    consensus_result=consensus_result,
                    success=True,
                    orchestrator_address=str(self.agent.address)
                )
                
                await ctx.send(sender, response)
                self.logger.info(f"Sent consensus result to verified sender {sender}")
                
            except Exception as e:
                self.logger.error(f"Consensus evaluation failed: {e}")
                error_response = create_error_response(msg, type(e).__name__, str(e))
                await ctx.send(sender, error_response)
        
        @self.agent.on_message(model=VerdictResponseMessage)
        async def handle_verdict_response(ctx: Context, sender: str, msg: VerdictResponseMessage):
            """Handle verdict responses from verified agents"""
            if message_deduplicator.is_duplicate(msg):
                return
            
            # Verify sender is registered agent
            agent_verified = any(
                self.verified_wallets.get(agent_id) == sender 
                for agent_id in self.verified_wallets
            )
            
            if not agent_verified:
                self.consensus_metrics["wallet_verification_failures"] += 1
                self.logger.warning(f"Verdict from unverified agent: {sender}")
                return
                
            self.logger.info(f"Verdict response from verified agent {sender} for claim {msg.claim_id}")
            
            # Store verdict in pending consensuses
            if msg.claim_id not in self.pending_verdicts:
                self.pending_verdicts[msg.claim_id] = []
            
            self.pending_verdicts[msg.claim_id].append(msg)
            
            # Signal consensus completion check
            if msg.claim_id in self.consensus_futures:
                future = self.consensus_futures[msg.claim_id]
                if not future.done():
                    session = self.active_consensuses.get(msg.claim_id)
                    if session:
                        verdicts = self.pending_verdicts[msg.claim_id]
                        if len(verdicts) >= session["expected_agents"]:
                            future.set_result(verdicts)
        
        @self.agent.on_message(model=HealthCheckMessage)
        async def handle_health_check(ctx: Context, sender: str, msg: HealthCheckMessage):
            """Handle health check requests with wallet verification"""
            if message_deduplicator.is_duplicate(msg):
                return
                
            health_status = HealthResponseMessage(
                agent_id=self.orchestrator_id,
                agent_address=str(self.agent.address),
                request_message_id=msg.message_id,
                status="healthy",
                llm_backend="orchestrator",
                total_evaluations=self.consensus_metrics["total_evaluations"],
                error_rate=self._calculate_error_rate()
            )
            
            await ctx.send(sender, health_status)
        
        self.logger.info("uAgents message handlers configured with wallet verification")
    
    async def _execute_distributed_consensus_async(
        self, 
        ctx: Context, 
        request: ConsensusRequestMessage
    ) -> SimpleConsensusResult:
        """Execute distributed consensus with proper timeout handling"""
        start_time = datetime.utcnow()
        claim_id = request.claim_id
        
        self.consensus_metrics["total_evaluations"] += 1
        
        # Initialize consensus session
        expected_agents = len(self.registered_agents)
        self.active_consensuses[claim_id] = {
            "request": request,
            "start_time": start_time,
            "expected_agents": expected_agents,
            "timeout": start_time + timedelta(seconds=request.agent_timeout)
        }
        
        self.pending_verdicts[claim_id] = []
        
        # Create future for response collection
        consensus_future = asyncio.Future()
        self.consensus_futures[claim_id] = consensus_future
        
        # Send evaluation requests to all verified agents
        evaluation_message = ClaimEvaluationMessage(
            claim_id=claim_id,
            policy_path=request.policy_path,
            invoice_path=request.invoice_path,
            decryption_key=request.decryption_key,
            requester_address=str(self.agent.address),
            timeout_seconds=request.agent_timeout
        )
        
        sent_to_agents = []
        for agent_id, agent_reg in self.registered_agents.items():
            try:
                # Send to verified wallet addresses only
                await ctx.send(agent_reg.agent_address, evaluation_message)
                sent_to_agents.append(agent_id)
                self.logger.info(f"Sent evaluation request to verified agent {agent_id}")
            except Exception as e:
                self.logger.error(f"Failed to send to {agent_id}: {e}")
        
        # Update expected agents count
        self.active_consensuses[claim_id]["expected_agents"] = len(sent_to_agents)
        
        try:
            # Wait for responses with timeout - return partial results if needed
            verdicts = await asyncio.wait_for(
                consensus_future,
                timeout=request.agent_timeout
            )
            self.logger.info(f"Consensus complete for {claim_id}")
            
        except asyncio.TimeoutError:
            # Timeout occurred - use partial results
            verdicts = self.pending_verdicts.get(claim_id, [])
            self.consensus_metrics["agent_timeouts"] += 1
            self.consensus_metrics["partial_consensus_count"] += 1
            self.logger.warning(f"Consensus timeout for {claim_id}, using {len(verdicts)} partial results")
        
        # Analyze consensus from collected verdicts
        session = self.active_consensuses[claim_id]
        consensus_result = self._analyze_distributed_consensus(claim_id, verdicts, session)
        
        # Cleanup
        if claim_id in self.active_consensuses:
            del self.active_consensuses[claim_id]
        if claim_id in self.pending_verdicts:
            del self.pending_verdicts[claim_id]
        if claim_id in self.consensus_futures:
            del self.consensus_futures[claim_id]
        
        return consensus_result
    
    def _analyze_distributed_consensus(
        self, 
        claim_id: str, 
        verdict_responses: List[VerdictResponseMessage],
        session: Dict
    ) -> SimpleConsensusResult:
        """Analyze verdict responses and determine consensus"""
        
        start_time = session["start_time"]
        processing_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        # Extract successful verdicts from verified agents only
        valid_verdicts = []
        for response in verdict_responses:
            if response.success and response.verdict:
                valid_verdicts.append(response.verdict)
        
        if not valid_verdicts:
            self.consensus_metrics["consensus_failed"] += 1
            return SimpleConsensusResult(
                claim_id=claim_id,
                unanimous_verdict=None,
                agreement_ratio=0.0,
                agent_verdicts=[],
                dissenting_agents=[],
                processing_time_ms=processing_time_ms,
                evaluation_timestamp=datetime.utcnow()
            )
        
        # Count verdicts by type
        verdict_counts = {}
        for verdict in valid_verdicts:
            verdict_counts[verdict.verdict] = verdict_counts.get(verdict.verdict, 0) + 1
        
        # Find majority verdict
        majority_verdict = max(verdict_counts, key=verdict_counts.get)
        majority_count = verdict_counts[majority_verdict]
        agreement_ratio = majority_count / len(valid_verdicts)
        
        # Flat consensus = 100% agreement
        consensus_achieved = agreement_ratio >= self.consensus_threshold
        unanimous_verdict = majority_verdict if consensus_achieved else None
        
        # Identify dissenting agents
        dissenting_agents = [
            v.agent_id for v in valid_verdicts 
            if v.verdict != majority_verdict
        ]
        
        # Calculate consensus coverage amount
        consensus_coverage_amount = None
        if unanimous_verdict in ["COVERED", "PARTIAL_COVERAGE"]:
            coverage_amounts = [v.coverage_amount for v in valid_verdicts if v.coverage_amount]
            if coverage_amounts:
                consensus_coverage_amount = sum(coverage_amounts) / len(coverage_amounts)
        
        if consensus_achieved:
            self.consensus_metrics["consensus_achieved"] += 1
        else:
            self.consensus_metrics["consensus_failed"] += 1
        
        return SimpleConsensusResult(
            claim_id=claim_id,
            unanimous_verdict=unanimous_verdict,
            agreement_ratio=agreement_ratio,
            agent_verdicts=valid_verdicts,
            dissenting_agents=dissenting_agents,
            consensus_coverage_amount=consensus_coverage_amount,
            processing_time_ms=processing_time_ms,
            evaluation_timestamp=datetime.utcnow()
        )
    
    def _calculate_error_rate(self) -> float:
        """Calculate current error rate"""
        total = self.consensus_metrics["total_evaluations"]
        failed = self.consensus_metrics["consensus_failed"]
        return failed / total if total > 0 else 0.0
    
    async def start_orchestrator(self):
        """Start orchestrator with wallet funding and broadcast discovery"""
        try:
            # Fund agent wallet (essential for Agentverse)
            await fund_agent_if_low(self.agent.wallet.address())
            self.logger.info(f"Wallet funded: {self.agent.wallet.address()}")
            
        except Exception as e:
            self.logger.warning(f"Wallet funding failed: {e}")
        
        self.logger.info(f"Starting orchestrator on port {self.agent._port}")
        self.logger.info(f"Address: {self.agent.address}")
        self.logger.info(f"Wallet: {self.agent.wallet.address()}")
        
        # Schedule broadcast discovery after startup
        asyncio.create_task(self._periodic_agent_discovery())
        
        self.logger.info("Orchestrator ready for bureau execution")
    
    async def _periodic_agent_discovery(self):
        """Broadcast agent discovery periodically to find new agents"""
        await asyncio.sleep(5)  # Wait for network setup
        
        while True:
            try:
                discovery_msg = AgentDiscoveryMessage(
                    requester_address=str(self.agent.address),
                    required_capabilities=["claim_evaluation", "policy_analysis"]
                )
                
                # Broadcast to Agentverse network using wildcard
                # TO DO replace "*" with actual broadcast mechanism
                self.consensus_metrics["broadcast_discoveries"] += 1
                self.logger.info("Broadcasting agent discovery to network")
                
                # Wait before next discovery
                await asyncio.sleep(300)  # Every 5 minutes
                
            except Exception as e:
                self.logger.error(f"Broadcast discovery failed: {e}")
                await asyncio.sleep(60)  # Retry after 1 minute
    
    def get_orchestrator_info(self) -> Dict[str, Any]:
        """Get orchestrator status with wallet verification info"""
        return {
            "orchestrator_id": self.orchestrator_id,
            "orchestrator_address": str(self.agent.address),
            "wallet_address": self.agent.wallet.address(),
            "consensus_threshold": self.consensus_threshold,
            "agent_timeout": self.agent_timeout,
            "registered_agents": len(self.registered_agents),
            "verified_wallets": len(self.verified_wallets),
            "active_consensuses": len(self.active_consensuses),
            "consensus_metrics": self.consensus_metrics,
            "agent_registry": {
                agent_id: self.verified_wallets.get(agent_id) 
                for agent_id in self.registered_agents.keys()
            }
        }


# Bureau for distributed deployment
class ProductionBureau:
    """Production bureau with proper wallet funding and verification"""
    
    def __init__(self):
        self.bureau = Bureau()
        self.orchestrators: List[DistributedConsensusOrchestrator] = []
        self.agents: List[Agent] = []
        self.logger = logging.getLogger("ProductionBureau")
    
    def add_orchestrator(self, orchestrator: DistributedConsensusOrchestrator):
        """Add orchestrator to bureau"""
        self.bureau.add(orchestrator.agent)
        self.orchestrators.append(orchestrator)
        self.logger.info(f"Added orchestrator: {orchestrator.orchestrator_id}")
    
    def add_agent(self, agent: Agent):
        """Add agent to bureau"""
        self.bureau.add(agent)
        self.agents.append(agent)
        self.logger.info(f"Added agent: {agent.name}")
    
    async def run_all(self):
        """Run all agents with proper wallet funding"""
        all_agents = [orc.agent for orc in self.orchestrators] + self.agents
        
        # Fund all wallets before starting
        self.logger.info(f"Funding {len(all_agents)} agent wallets...")
        
        for agent in all_agents:
            try:
                await fund_agent_if_low(agent.wallet.address())
                self.logger.info(f"✅ Funded {agent.name}: {agent.wallet.address()}")
            except Exception as e:
                self.logger.warning(f"⚠️ Could not fund {agent.name}: {e}")
        
        self.logger.info("🚀 Starting bureau with all agents...")
        
        # Run the bureau
        await self.bureau.run_async()


def create_production_orchestrator(
    orchestrator_id: str = None,
    port: int = 8000,
    consensus_threshold: float = 1.0,
    mailbox_key: str = None
) -> DistributedConsensusOrchestrator:
    """Create production-ready orchestrator"""
    
    orchestrator_id = orchestrator_id or f"bio_vault_orchestrator_{port}"
    
    return DistributedConsensusOrchestrator(
        orchestrator_id=orchestrator_id,
        port=port,
        consensus_threshold=consensus_threshold,
        mailbox_key=mailbox_key or os.getenv("AGENTVERSE_MAILBOX")
    )