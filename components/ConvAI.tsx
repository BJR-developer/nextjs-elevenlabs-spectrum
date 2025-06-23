"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { useCallback, useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConversation } from "@elevenlabs/react";
import { cn } from "@/lib/utils";

async function requestMicrophonePermission() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch {
    console.error("Microphone permission denied");
    return false;
  }
}

async function getSignedUrl(): Promise<string> {
  const response = await fetch("/api/signed-url");
  if (!response.ok) {
    throw Error("Failed to get signed url");
  }
  const data = await response.json();
  return data.signedUrl;
}

export function ConvAI() {
  // State for real-time frequency visualization
  const [realTimeFrequencyData, setRealTimeFrequencyData] = useState<number[]>([]);
  const animationFrameRef = useRef<number>();

  console.log("realTimeFrequencyData: ", realTimeFrequencyData);

  const conversation = useConversation({
    onConnect: () => {
      console.log("connected");
      // Wait a bit for the connection to fully establish, then start frequency analysis
      setTimeout(() => {
        console.log("Starting frequency analysis after delay...");
        startFrequencyAnalysis();
      }, 1000);
    },
    onDisconnect: () => {
      console.log("disconnected");
      // Stop real-time frequency analysis
      stopFrequencyAnalysis();
    },
    onError: error => {
      console.log(error);
      alert("An error occurred during the conversation");
    },
    onMessage: message => {
      console.log(message);
    },
  });



  // Real-time frequency analysis functions
  const startFrequencyAnalysis = useCallback(() => {
    console.log("Starting frequency analysis...");
    
    const analyzeFrequency = () => {
      // Enhanced debugging
      console.log("Analysis loop running, conversation:", {
        exists: !!conversation,
        status: conversation?.status,
        isSpeaking: conversation?.isSpeaking,
        hasGetOutputByteFrequencyData: typeof conversation?.getOutputByteFrequencyData === 'function',
        hasGetOutputVolume: typeof conversation?.getOutputVolume === 'function'
      });

      if (conversation) {
        try {
          // Get real-time frequency data from the conversation
          const frequencyData = conversation.getOutputByteFrequencyData();
          const volume = conversation.getOutputVolume();
          
          console.log("Raw audio data:", {
            status: conversation.status,
            frequencyData,
            frequencyDataType: typeof frequencyData,
            frequencyDataLength: frequencyData?.length,
            volume,
            volumeType: typeof volume,
            isSpeaking: conversation.isSpeaking
          });
          
          if (frequencyData && frequencyData.length > 0) {
            // Convert frequency data to array of numbers for visualization
            const freqArray = Array.from(frequencyData).slice(0, 32); // Take first 32 frequency bins
            setRealTimeFrequencyData(freqArray);
            
            console.log(`SUCCESS - Volume: ${volume.toFixed(2)}, FreqData: [${freqArray.slice(0, 5).join(', ')}...]`);
          } else {
            // Only log occasionally to avoid spam
            if (Math.random() < 0.01) {
              console.log("No frequency data available - Status:", conversation.status, "Speaking:", conversation.isSpeaking);
            }
            setRealTimeFrequencyData([]);
          }
        } catch (error) {
          console.error("Error in frequency analysis:", error);
        }
        
        // Continue analysis regardless of connection status
        animationFrameRef.current = requestAnimationFrame(analyzeFrequency);
      } else {
        console.log("Conversation object not available");
      }
    };
    
    // Start the analysis loop
    analyzeFrequency();
  }, [conversation]);

  const stopFrequencyAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    setRealTimeFrequencyData([]);
  }, []);

  async function startConversation() {
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      alert("No permission");
      return;
    }
    const signedUrl = await getSignedUrl();
    const conversationId = await conversation.startSession({ signedUrl });
    console.log(conversationId);
  }

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      stopFrequencyAnalysis();
    };
  }, [stopFrequencyAnalysis]);

  return (
    <div className={"flex justify-center items-center gap-x-4"}>
      <Card className={"rounded-3xl"}>
        <CardContent>
          <CardHeader>
            <CardTitle className={"text-center"}>
              {conversation.status === "connected"
                ? conversation.isSpeaking
                  ? `Agent is speaking`
                  : "Agent is listening"
                : "Disconnected"}
            </CardTitle>

          </CardHeader>
          <div className={"flex flex-col gap-y-4 text-center"}>
            {/* Enhanced orb with real-time waveform data */}
            <div className="relative">
              <div
                className={cn(
                  "orb my-16 mx-12",
                  conversation.status === "connected" && conversation.isSpeaking
                    ? "orb-active animate-orb"
                    : conversation.status === "connected"
                    ? "animate-orb-slow orb-inactive"
                    : "orb-inactive"
                )}
                style={{
                  transform: realTimeFrequencyData.length > 0 
                    ? `scale(${1 + (conversation?.getOutputVolume() || 0) / 2})` 
                    : 'scale(1)',
                  transition: 'transform 0.05s ease-out'
                }}
              ></div>
              
              {/* Real-time frequency waveform visualization */}
              {realTimeFrequencyData.length > 0 && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                  {/* Frequency bars */}
                  <div className="flex items-end gap-1 h-16 mb-2">
                    {realTimeFrequencyData.slice(0, 16).map((frequency, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-t from-blue-500 to-purple-500 w-2 transition-all duration-75"
                        style={{
                          height: `${Math.max(2, (frequency / 255) * 60)}px`,
                          opacity: 0.6 + (frequency / 255) * 0.4
                        }}
                      />
                    ))}
                  </div>
                  
                  {/* Volume indicator */}
                  <div className="text-xs text-center text-gray-500">
                    Volume: {(conversation?.getOutputVolume() || 0).toFixed(2)}
                  </div>
                </div>
              )}
              
              
            </div>

            <Button
              variant={"outline"}
              className={"rounded-full"}
              size={"lg"}
              disabled={
                conversation !== null && conversation.status === "connected"
              }
              onClick={startConversation}
            >
              Start conversation
            </Button>
            <Button
              variant={"outline"}
              className={"rounded-full"}
              size={"lg"}
              disabled={conversation === null}
              onClick={stopConversation}
            >
              End conversation
            </Button>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
