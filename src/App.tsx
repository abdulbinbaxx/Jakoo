/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import * as pdfjs from 'pdfjs-dist';
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  Sparkles, 
  FileCheck, 
  AlertCircle,
  FileCode,
  FileImage as ImageIcon,
  File as FileIcon,
  Copy,
  Check,
  Brain,
  BrainCircuit,
  Trophy,
  ChevronRight,
  ChevronLeft,
  RefreshCcw,
  HelpCircle,
  History,
  Trash2,
  Plus,
  Sun,
  Moon,
  Menu,
  BookOpen,
  Layout,
  LayoutDashboard,
  Youtube,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Type } from "@google/genai";
import { useEffect } from 'react';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const JakooLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M16 4v12a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4" />
    <path d="M16 4l-2-2 2-2 2 2-2 2z" fill="currentColor" stroke="none" />
  </svg>
);

interface FileWithContent {
  file: File;
  content: string | ArrayBuffer | null;
  type: string;
  name: string;
  id: string;
}

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  topic: string; // Added topic for tracking
}

interface Quiz {
  title: string;
  questions: QuizQuestion[];
}

interface QuizHistoryItem {
  id: string;
  title: string;
  score: number;
  total: number;
  date: string;
}

interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  description: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'summary' | 'quiz' | 'key-topics' | 'progress' | 'videos'>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [userDepartment, setUserDepartment] = useState<string>('');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [files, setFiles] = useState<FileWithContent[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quiz State
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, { isCorrect: boolean; showFeedback: boolean }>>({});
  const [showResults, setShowResults] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isSearchingVideos, setIsSearchingVideos] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history and active quiz on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('quiz_history');
    if (savedHistory) {
      try {
        setQuizHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse quiz history", e);
      }
    }

    const savedAppState = localStorage.getItem('app_state');
    const savedUserName = localStorage.getItem('userName');
    const savedUserDept = localStorage.getItem('userDepartment');

    if (savedUserName) setUserName(savedUserName);
    if (savedUserDept) setUserDepartment(savedUserDept);
    if (!savedUserName || !savedUserDept) setShowOnboarding(true);

    if (savedAppState) {
      try {
        const data = JSON.parse(savedAppState);
        if (data.analysisResult) setAnalysisResult(data.analysisResult);
        if (data.activeTab) setActiveTab(data.activeTab as any);
        if (data.quiz) setQuiz(data.quiz);
        if (data.currentQuestionIndex !== undefined) setCurrentQuestionIndex(data.currentQuestionIndex);
        if (data.userAnswers) setUserAnswers(data.userAnswers);
        if (data.answeredQuestions) setAnsweredQuestions(data.answeredQuestions);
        if (data.quizScore !== undefined) setQuizScore(data.quizScore);
        if (data.showResults !== undefined) setShowResults(data.showResults);
        if (data.weakTopics) setWeakTopics(data.weakTopics);
        if (data.theme) setTheme(data.theme);
        if (data.videos) setVideos(data.videos);
      } catch (e) {
        console.error("Failed to parse app state", e);
      }
    }
  }, []);

  // Save app state
  useEffect(() => {
    const stateToSave = {
      analysisResult,
      activeTab,
      quiz,
      currentQuestionIndex,
      userAnswers,
      answeredQuestions,
      quizScore,
      showResults,
      weakTopics,
      theme,
      videos
    };
    localStorage.setItem('app_state', JSON.stringify(stateToSave));
    
    // Apply theme class to html element
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [analysisResult, activeTab, quiz, currentQuestionIndex, userAnswers, answeredQuestions, quizScore, showResults, weakTopics, theme]);

  const saveToHistory = (score: number, total: number, title: string) => {
    const newItem: QuizHistoryItem = {
      id: Math.random().toString(36).substring(7),
      title,
      score,
      total,
      date: new Date().toISOString(),
    };
    const updatedHistory = [newItem, ...quizHistory].slice(0, 10); // Keep last 10
    setQuizHistory(updatedHistory);
    localStorage.setItem('quiz_history', JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    setQuizHistory([]);
    localStorage.removeItem('quiz_history');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (newFiles: File[]) => {
    const processedFiles: FileWithContent[] = await Promise.all(
      newFiles.map(async (file) => {
        return new Promise<FileWithContent>((resolve) => {
          const reader = new FileReader();
          
          if (file.type === 'application/pdf') {
            reader.onload = async (e) => {
              const arrayBuffer = e.target?.result as ArrayBuffer;
              try {
                const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const textContent = await page.getTextContent();
                  const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');
                  fullText += pageText + '\n';
                }
                
                console.log(`[PDF Extraction] Successfully read ${file.name}:`);
                console.log(fullText);
                
                resolve({
                  file,
                  content: fullText,
                  type: file.type,
                  name: file.name,
                  id: Math.random().toString(36).substring(7),
                });
              } catch (err) {
                console.error(`[PDF Error] Failed to read ${file.name}:`, err);
                resolve({
                  file,
                  content: "Error extracting PDF text. The file might be corrupted or protected.",
                  type: file.type,
                  name: file.name,
                  id: Math.random().toString(36).substring(7),
                });
              }
            };
            reader.readAsArrayBuffer(file);
          } else {
            reader.onload = (e) => {
              const content = e.target?.result || null;
              if (typeof content === 'string' && !file.type.startsWith('image/')) {
                console.log(`[Text Extraction] Successfully read ${file.name}:`);
                console.log(content);
              } else if (file.type.startsWith('image/')) {
                console.log(`[Image Load] Successfully loaded ${file.name} as Base64`);
              }

              resolve({
                file,
                content,
                type: file.type,
                name: file.name,
                id: Math.random().toString(36).substring(7),
              });
            };
            
            if (file.type.startsWith('image/')) {
              reader.readAsDataURL(file);
            } else {
              reader.readAsText(file);
            }
          }
        });
      })
    );
    setFiles((prev) => [...prev, ...processedFiles]);
    setError(null);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const fetchYouTubeVideos = async (topics: string[]) => {
    if (topics.length === 0) return;
    
    setIsSearchingVideos(true);
    try {
      const model = "gemini-3-flash-preview";
      const prompt = `Based on these study topics: ${topics.join(', ')}, find 10 highly relevant educational YouTube videos. 
      Return a JSON array of objects with: id (YouTube video ID), title, thumbnail (high quality URL), channelTitle, and description.
      Ensure the IDs are valid YouTube video IDs.`;
      
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                thumbnail: { type: Type.STRING },
                channelTitle: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['id', 'title', 'thumbnail', 'channelTitle', 'description']
            }
          }
        }
      });
      
      const foundVideos = JSON.parse(response.text || "[]");
      setVideos(foundVideos);
    } catch (err) {
      console.error("Failed to fetch videos:", err);
    } finally {
      setIsSearchingVideos(false);
    }
  };

  const analyzeMaterials = async () => {
    if (files.length === 0) {
      setError("Please upload at least one file to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError(null);
    setActiveTab('summary');

    try {
      const model = "gemini-3-flash-preview";
      
      const parts = files.map((f) => {
        if (f.type.startsWith('image/')) {
          const base64Data = (f.content as string).split(',')[1];
          return {
            inlineData: {
              data: base64Data,
              mimeType: f.type,
            },
          };
        } else {
          return { text: `File: ${f.name}\nContent:\n${f.content}` };
        }
      });

      const prompt = `
        You are an expert research assistant. Analyze the provided materials (documents, code, and images) and generate a high-quality summary.
        
        Structure your response as follows:
        1. **Executive Summary**: A concise 2-3 sentence overview of all materials.
        2. **Key Insights**: Bullet points highlighting the most important findings or data.
        3. **Detailed Analysis**: A deeper dive into specific themes or sections found in the materials.
        4. **Conclusion/Next Steps**: Final thoughts or recommendations based on the analysis.
        
        Be precise, objective, and professional. If multiple files are provided, identify connections between them.
      `;
      
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [...parts, { text: prompt }] },
      });

      setAnalysisResult(response.text || "No analysis generated.");

      // Extract topics and fetch videos
      const topics = response.text?.match(/#{1,3}\s+(.+)/g)?.map(t => t.replace(/#{1,3}\s+/, '')) || [];
      if (topics.length > 0) {
        fetchYouTubeVideos(topics.slice(0, 10));
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Failed to analyze materials. Please check your files and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateQuiz = async () => {
    if (files.length === 0) {
      setError("Please upload at least one file to generate a quiz.");
      return;
    }

    setIsGeneratingQuiz(true);
    setQuiz(null);
    setError(null);
    setActiveTab('quiz');
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setAnsweredQuestions({});
    setShowResults(false);
    setQuizScore(0);

    try {
      const model = "gemini-3-flash-preview";
      
      const parts = files.map((f) => {
        if (f.type.startsWith('image/')) {
          const base64Data = (f.content as string).split(',')[1];
          return {
            inlineData: {
              data: base64Data,
              mimeType: f.type,
            },
          };
        } else {
          return { text: `File: ${f.name}\nContent:\n${f.content}` };
        }
      });

      const prompt = "Generate a challenging quiz based on these materials. Include 20 questions of varying types (multiple-choice, true-false, and short-answer). For each question, assign a 'topic' (e.g., 'Historical Context', 'Technical Details', 'Main Arguments'). Ensure the questions test deep understanding of the content.";
      
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [...parts, { text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { 
                      type: Type.STRING, 
                      enum: ['multiple-choice', 'true-false', 'short-answer'] 
                    },
                    question: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    options: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING } 
                    },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ['id', 'type', 'question', 'correctAnswer', 'explanation', 'topic']
                }
              }
            },
            required: ['title', 'questions']
          }
        }
      });

      const quizData = JSON.parse(response.text || "{}");
      setQuiz(quizData);
    } catch (err) {
      console.error("Quiz generation failed:", err);
      setError("Failed to generate quiz. Please try again.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    if (answeredQuestions[questionId]?.showFeedback) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
    
    // For MCQ and True/False, provide instant feedback
    const currentQuestion = quiz?.questions.find(q => q.id === questionId);
    if (currentQuestion && (currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'true-false')) {
      checkInstantAnswer(questionId, answer, currentQuestion);
    }
  };

  const checkInstantAnswer = (questionId: string, answer: string, question: QuizQuestion) => {
    const isCorrect = answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
    setAnsweredQuestions(prev => ({ 
      ...prev, 
      [questionId]: { isCorrect, showFeedback: true } 
    }));
    if (isCorrect) setQuizScore(prev => prev + 1);
  };

  const checkShortAnswer = (questionId: string) => {
    const currentQuestion = quiz?.questions.find(q => q.id === questionId);
    const userAnswer = userAnswers[questionId]?.toLowerCase().trim();
    if (!currentQuestion || !userAnswer) return;

    const correctAnswer = currentQuestion.correctAnswer.toLowerCase().trim();
    const isCorrect = correctAnswer.includes(userAnswer) || userAnswer.includes(correctAnswer);
    
    setAnsweredQuestions(prev => ({ 
      ...prev, 
      [questionId]: { isCorrect, showFeedback: true } 
    }));
    if (isCorrect) setQuizScore(prev => prev + 1);
  };

  const submitQuiz = () => {
    if (quiz) {
      saveToHistory(quizScore, quiz.questions.length, quiz.title);
      
      // Analyze weak topics
      const topicStats: Record<string, { correct: number; total: number }> = {};
      quiz.questions.forEach(q => {
        if (!topicStats[q.topic]) topicStats[q.topic] = { correct: 0, total: 0 };
        topicStats[q.topic].total++;
        if (answeredQuestions[q.id]?.isCorrect) {
          topicStats[q.topic].correct++;
        }
      });

      const weak = Object.entries(topicStats)
        .filter(([_, stats]) => (stats.correct / stats.total) < 0.6)
        .map(([topic]) => topic);
      
      setWeakTopics(weak);
    }
    setShowResults(true);
  };

  const copyToClipboard = () => {
    if (analysisResult) {
      navigator.clipboard.writeText(analysisResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-ayb-green" />;
    if (type.includes('javascript') || type.includes('typescript') || type.includes('json')) return <FileCode className="w-5 h-5 text-ayb-green" />;
    if (type.includes('pdf') || type.includes('text')) return <FileText className="w-5 h-5 text-red-500" />;
    return <FileIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />;
  };

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim() && userDepartment.trim()) {
      localStorage.setItem('userName', userName);
      localStorage.setItem('userDepartment', userDepartment);
      setShowOnboarding(false);
    }
  };

  const renderOnboarding = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 lg:p-12 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-700"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-ayb-green/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <JakooLogo className="w-10 h-10 text-ayb-green" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Welcome to JAKOO</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Let's personalize your study experience.</p>
        </div>

        <form onSubmit={handleOnboardingSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Your Full Name</label>
            <input 
              required
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Abdurrahman"
              className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-ayb-green transition-all outline-none text-gray-900 dark:text-white font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Department / Course</label>
            <input 
              required
              type="text"
              value={userDepartment}
              onChange={(e) => setUserDepartment(e.target.value)}
              placeholder="e.g. Computer Science"
              className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-ayb-green transition-all outline-none text-gray-900 dark:text-white font-medium"
            />
          </div>

          <button 
            type="submit"
            className="w-full py-5 bg-ayb-green text-white rounded-2xl font-bold text-lg hover:bg-ayb-green-dark transition-all shadow-xl shadow-ayb-green/20 flex items-center justify-center gap-2 group"
          >
            Start Studying
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </motion.div>
    </motion.div>
  );

  const renderDashboardSection = () => {
    const averageScore = quizHistory.length > 0 
      ? Math.round((quizHistory.reduce((acc, curr) => acc + (curr.score / curr.total), 0) / quizHistory.length) * 100)
      : 0;

    return (
      <motion.div
        key="dashboard"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-8"
      >
        <div className="relative overflow-hidden bg-gray-900 rounded-[2.5rem] p-8 lg:p-12 text-white shadow-2xl transition-all duration-500 group">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" 
              alt="Technology Background"
              className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-1000"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/60 to-transparent" />
          </div>

          <div className="relative z-10 max-w-2xl">
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-4 leading-tight">
              Welcome back, <span className="text-white/80 italic">{userName || 'Student'}</span>
            </h2>
            <p className="text-lg text-white/80 font-medium mb-8 max-w-lg">
              Your AI-powered study companion is ready. Analyze your materials, test your knowledge, and track your progress all in one place.
            </p>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setActiveTab('upload')}
                className="px-8 py-4 bg-white text-ayb-green rounded-2xl font-bold hover:bg-white/90 transition-all shadow-xl shadow-black/10 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Study Session
              </button>
              {analysisResult && (
                <button 
                  onClick={() => setActiveTab('quiz')}
                  className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl font-bold hover:bg-white/20 transition-all flex items-center gap-2"
                >
                  <BrainCircuit className="w-5 h-5" />
                  Quick Quiz
                </button>
              )}
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-64 h-64 bg-black/10 rounded-full blur-2xl" />
          <JakooLogo className="absolute top-12 right-12 w-24 h-24 text-white/10 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            whileHover={{ y: -10, scale: 1.02 }}
            className="bg-white dark:bg-gray-800/60 backdrop-blur-md p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all group perspective-1000"
          >
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-12 transition-all">
              <FileText className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            </div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Materials Analyzed</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{files.length}</p>
          </motion.div>
          
          <motion.div 
            whileHover={{ y: -10, scale: 1.02 }}
            className="bg-white dark:bg-gray-800/60 backdrop-blur-md p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all group perspective-1000"
          >
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-12 transition-all">
              <BrainCircuit className="w-6 h-6 text-purple-500 dark:text-purple-400" />
            </div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Quizzes Taken</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{quizHistory.length}</p>
          </motion.div>
 
          <motion.div 
            whileHover={{ y: -10, scale: 1.02 }}
            className="bg-white dark:bg-gray-800/60 backdrop-blur-md p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all group perspective-1000"
          >
            <div className="w-12 h-12 bg-ayb-green/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-12 transition-all">
              <Trophy className="w-6 h-6 text-ayb-green" />
            </div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Average Mastery</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white">{averageScore}%</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-gray-400" />
                Recent Activity
              </h3>
              <button 
                onClick={() => setActiveTab('progress')}
                className="text-xs font-bold text-ayb-green hover:underline"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {quizHistory.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm text-gray-400 italic">No activity yet. Start by uploading a document!</p>
                </div>
              ) : (
                quizHistory.slice(0, 3).map((item) => (
                  <div key={item.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        (item.score / item.total) >= 0.7 ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {Math.round((item.score / item.total) * 100)}%
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{item.title}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{new Date(item.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-8">
            <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              Study Tip
            </h3>
            <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-2xl p-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-400 font-medium leading-relaxed italic">
                "Spaced repetition is key to long-term retention. Try reviewing your key topics 24 hours after your first study session, then again after 3 days and 1 week."
              </p>
            </div>
            <div className="mt-8 space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quick Actions</p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setActiveTab('key-topics')}
                  className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <BookOpen className="w-5 h-5 text-gray-400 group-hover:text-ayb-green mb-2 transition-colors" />
                  <p className="text-xs font-bold text-gray-900 dark:text-white">Review Topics</p>
                </button>
                <button 
                  onClick={() => setActiveTab('summary')}
                  className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <FileText className="w-5 h-5 text-gray-400 group-hover:text-ayb-green mb-2 transition-colors" />
                  <p className="text-xs font-bold text-gray-900 dark:text-white">Read Summary</p>
                </button>
              </div>
            </div>
          </section>
        </div>
      </motion.div>
    );
  };

  const renderUploadSection = () => (
    <motion.div
      key="upload"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <section>
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Study Materials</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Add PDFs, images, or text files to start your AI-powered study session.</p>
        </div>

        <div 
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            await processFiles(Array.from(e.dataTransfer.files));
          }}
          className="group relative border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl p-16 flex flex-col items-center justify-center gap-6 bg-white dark:bg-gray-800 hover:border-ayb-green hover:bg-ayb-green/5 transition-all cursor-pointer overflow-hidden"
        >
          <div className="w-20 h-20 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center group-hover:scale-110 group-hover:bg-ayb-green/10 transition-all duration-300">
            <Upload className="w-10 h-10 text-gray-400 dark:text-gray-600 group-hover:text-ayb-green" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-white">Click or drag files here</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Support for PDF, Images, Text, and Code files</p>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            className="hidden" 
          />
        </div>
      </section>

      {files.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Selected Files</h4>
            <button 
              onClick={() => setFiles([])}
              className="text-xs font-bold text-red-500 hover:text-red-600"
            >
              Remove All
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {files.map((f) => (
              <motion.div
                key={f.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm group hover:border-ayb-green transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg group-hover:bg-ayb-green/10 transition-colors">
                    {getFileIcon(f.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate text-gray-700 dark:text-gray-200">{f.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-tighter">
                      {f.type.split('/')[1] || 'file'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => removeFile(f.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              onClick={analyzeMaterials}
              disabled={isAnalyzing || isGeneratingQuiz}
              className="flex-1 py-4 bg-ayb-green text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-ayb-green-dark disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-all shadow-xl shadow-ayb-green/20"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <FileCheck className="w-5 h-5" />
                  Generate Summary
                </>
              )}
            </button>

            <button
              onClick={generateQuiz}
              disabled={isAnalyzing || isGeneratingQuiz}
              className="flex-1 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-300 dark:disabled:text-gray-700 disabled:cursor-not-allowed transition-all"
            >
              {isGeneratingQuiz ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Quiz...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5 text-purple-500" />
                  Generate Quiz
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
        </motion.div>
      )}
    </motion.div>
  );

  const renderSummarySection = () => (
    <motion.div
      key="summary"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm overflow-hidden"
    >
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Analysis Report</h2>
        <div className="flex items-center gap-4">
          {analysisResult && (
            <>
              <button 
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-ayb-green dark:hover:text-ayb-green font-bold transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Report
                  </>
                )}
              </button>
              <button 
                onClick={() => setAnalysisResult(null)}
                className="text-xs text-ayb-green hover:underline font-bold"
              >
                Clear Results
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="p-8">
        {isAnalyzing ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-gray-400 dark:text-gray-500">
            <Loader2 className="w-12 h-12 animate-spin text-ayb-green" />
            <p className="text-sm font-medium animate-pulse">Processing materials and generating insights...</p>
          </div>
        ) : analysisResult ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-white prose-code:bg-gray-100 dark:prose-code:bg-gray-700 prose-code:px-1 prose-code:rounded"
          >
            <ReactMarkdown>{analysisResult}</ReactMarkdown>
            <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700 flex justify-center">
              <button
                onClick={() => setActiveTab('quiz')}
                className="flex items-center gap-2 px-8 py-4 bg-ayb-green text-white rounded-2xl font-bold hover:bg-ayb-green/90 transition-all shadow-xl shadow-ayb-green/10"
              >
                <BrainCircuit className="w-5 h-5" />
                Test Your Knowledge
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center gap-6 text-center">
            <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 rounded-3xl flex items-center justify-center">
              <FileText className="w-12 h-12 text-gray-200 dark:text-gray-700" />
            </div>
            <div>
              <p className="text-gray-900 dark:text-white font-bold text-lg">No analysis yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 max-w-[320px] mx-auto">
                Upload your documents and click "Generate Summary" to see the AI-powered insights here.
              </p>
              <button 
                onClick={() => setActiveTab('upload')}
                className="mt-6 px-6 py-2 bg-ayb-green text-white rounded-xl text-sm font-bold hover:bg-ayb-green/90 transition-colors"
              >
                Go to Upload
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  const renderQuizSection = () => (
    <motion.div
      key="quiz"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[600px]"
    >
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Knowledge Quiz</h2>
        {quiz && !showResults && (
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-100 dark:border-gray-700">
            Question {currentQuestionIndex + 1} of {quiz.questions.length}
          </span>
        )}
      </div>

      <div className="flex-1 p-8">
        {isGeneratingQuiz ? (
          <div className="h-full py-20 flex flex-col items-center justify-center gap-4 text-gray-400 dark:text-gray-500">
            <Loader2 className="w-12 h-12 animate-spin text-ayb-green" />
            <p className="text-sm font-medium animate-pulse">Generating a custom quiz from your materials...</p>
          </div>
        ) : quiz ? (
          <div className="h-full flex flex-col">
            {showResults ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                <div className="flex flex-col items-center text-center space-y-6 py-12 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                  <div className="w-24 h-24 bg-yellow-50 dark:bg-yellow-900/20 rounded-3xl flex items-center justify-center shadow-inner">
                    <Trophy className="w-12 h-12 text-yellow-500 dark:text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white">Quiz Completed!</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">You scored <span className="text-ayb-green font-bold">{quizScore}</span> out of {quiz.questions.length}</p>
                  </div>
                  <div className="w-full max-w-xs space-y-4">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-400 dark:text-gray-500 uppercase tracking-widest">Accuracy</span>
                      <span className="text-ayb-green">{Math.round((quizScore / quiz.questions.length) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(quizScore / quiz.questions.length) * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-ayb-green h-full rounded-full" 
                      />
                    </div>
                  </div>

                  {weakTopics.length > 0 && (
                    <div className="w-full max-w-md p-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-3xl text-left">
                      <p className="text-xs font-bold text-orange-800 dark:text-orange-400 uppercase tracking-widest mb-3">Focus Areas</p>
                      <div className="flex flex-wrap gap-2">
                        {weakTopics.map(topic => (
                          <span key={topic} className="px-3 py-1 bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-800 rounded-xl text-[10px] font-bold text-orange-700 dark:text-orange-400 shadow-sm">
                            {topic}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-orange-600 dark:text-orange-500 mt-4 font-medium italic">We recommend reviewing these topics in your study materials.</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button
                      onClick={generateQuiz}
                      className="flex items-center gap-2 px-6 py-3 bg-ayb-green text-white rounded-2xl text-sm font-bold hover:bg-ayb-green/90 transition-all shadow-lg shadow-ayb-green/10"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      New Quiz
                    </button>
                    <button
                      onClick={() => setActiveTab('progress')}
                      className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                      View Progress
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Detailed Review</h4>
                  <div className="grid grid-cols-1 gap-6">
                    {quiz.questions.map((q, idx) => {
                      const result = answeredQuestions[q.id];
                      const userAnswer = userAnswers[q.id];
                      
                      return (
                        <div key={q.id} className="border border-gray-100 dark:border-gray-700 rounded-3xl p-8 space-y-6 bg-white dark:bg-gray-800 shadow-sm hover:border-ayb-green/30 transition-all">
                          <div className="flex items-start gap-4">
                            <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-900 text-xs font-bold flex items-center justify-center mt-0.5 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                              {idx + 1}
                            </span>
                            <div className="space-y-1">
                              <p className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{q.question}</p>
                              <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-400 rounded uppercase tracking-tighter">
                                {q.topic}
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-2xl border ${result?.isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'}`}>
                              <p className="text-[10px] uppercase font-bold tracking-widest mb-2 opacity-50 dark:text-gray-400">Your Answer</p>
                              <p className={`text-sm font-bold ${result?.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                {userAnswer || 'No answer'}
                              </p>
                            </div>
                            {!result?.isCorrect && (
                              <div className="p-4 rounded-2xl border border-ayb-green/20 bg-ayb-green/5 dark:bg-ayb-green/10">
                                <p className="text-[10px] uppercase font-bold tracking-widest mb-2 opacity-50 text-ayb-green dark:text-ayb-green/70">Correct Answer</p>
                                <p className="text-sm font-bold text-ayb-green dark:text-ayb-green/90">{q.correctAnswer}</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] uppercase font-bold tracking-widest mb-2 opacity-50 dark:text-gray-400">Explanation</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 italic leading-relaxed">{q.explanation}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex-1 space-y-8 max-w-2xl mx-auto w-full">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-ayb-green/10 text-ayb-green rounded-full text-[10px] font-bold uppercase tracking-widest">
                        {quiz.questions[currentQuestionIndex].topic}
                      </span>
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        {quiz.questions[currentQuestionIndex].type.replace('-', ' ')}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                      {quiz.questions[currentQuestionIndex].question}
                    </h3>
                    
                    {quiz.questions[currentQuestionIndex].type === 'multiple-choice' && (
                      <div className="grid grid-cols-1 gap-3 mt-8">
                        {quiz.questions[currentQuestionIndex].options?.map((option, i) => {
                          const isSelected = userAnswers[quiz.questions[currentQuestionIndex].id] === option;
                          const isCorrect = option.toLowerCase().trim() === quiz.questions[currentQuestionIndex].correctAnswer.toLowerCase().trim();
                          const hasAnswered = answeredQuestions[quiz.questions[currentQuestionIndex].id]?.showFeedback;
                          
                          let buttonClass = "border-gray-100 dark:border-gray-700 hover:border-ayb-green/30 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50";
                          if (hasAnswered) {
                            if (isCorrect) buttonClass = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400";
                            else if (isSelected) buttonClass = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400";
                            else buttonClass = "border-gray-100 dark:border-gray-700 opacity-50 text-gray-400 dark:text-gray-600";
                          } else if (isSelected) {
                            buttonClass = "border-ayb-green bg-ayb-green/5 dark:bg-ayb-green/10 text-ayb-green";
                          }

                          return (
                            <button
                              key={i}
                              disabled={hasAnswered}
                              onClick={() => handleAnswerChange(quiz.questions[currentQuestionIndex].id, option)}
                              className={`p-5 text-left rounded-2xl border-2 transition-all flex items-center group ${buttonClass}`}
                            >
                              <span className={`inline-block w-8 h-8 rounded-xl text-center text-sm leading-8 mr-4 font-bold transition-colors ${
                                hasAnswered && isCorrect ? 'bg-green-500 text-white' : 
                                hasAnswered && isSelected && !isCorrect ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-ayb-green/10 group-hover:text-ayb-green'
                              }`}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="flex-1 font-medium">{option}</span>
                              {hasAnswered && isCorrect && <Check className="w-5 h-5 text-green-600 dark:text-green-400 ml-2" />}
                              {hasAnswered && isSelected && !isCorrect && <X className="w-5 h-5 text-red-600 dark:text-red-400 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {quiz.questions[currentQuestionIndex].type === 'true-false' && (
                      <div className="grid grid-cols-2 gap-4 mt-8">
                        {['True', 'False'].map((option) => {
                          const isSelected = userAnswers[quiz.questions[currentQuestionIndex].id] === option;
                          const isCorrect = option.toLowerCase().trim() === quiz.questions[currentQuestionIndex].correctAnswer.toLowerCase().trim();
                          const hasAnswered = answeredQuestions[quiz.questions[currentQuestionIndex].id]?.showFeedback;
 
                          let buttonClass = "border-gray-100 dark:border-gray-700 hover:border-ayb-green/30 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50";
                          if (hasAnswered) {
                            if (isCorrect) buttonClass = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400";
                            else if (isSelected) buttonClass = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400";
                            else buttonClass = "border-gray-100 dark:border-gray-700 opacity-50 text-gray-400 dark:text-gray-600";
                          } else if (isSelected) {
                            buttonClass = "border-ayb-green bg-ayb-green/5 dark:bg-ayb-green/10 text-ayb-green";
                          }

                          return (
                            <button
                              key={option}
                              disabled={hasAnswered}
                              onClick={() => handleAnswerChange(quiz.questions[currentQuestionIndex].id, option)}
                              className={`p-8 text-center rounded-2xl border-2 font-bold text-lg transition-all ${buttonClass}`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {quiz.questions[currentQuestionIndex].type === 'short-answer' && (
                      <div className="mt-8 space-y-4">
                        <textarea
                          value={userAnswers[quiz.questions[currentQuestionIndex].id] || ''}
                          disabled={answeredQuestions[quiz.questions[currentQuestionIndex].id]?.showFeedback}
                          onChange={(e) => handleAnswerChange(quiz.questions[currentQuestionIndex].id, e.target.value)}
                          placeholder="Type your answer here..."
                          className="w-full p-6 rounded-2xl border-2 border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-ayb-green focus:ring-4 focus:ring-ayb-green/10 outline-none transition-all min-h-[160px] text-lg font-medium"
                        />
                        {!answeredQuestions[quiz.questions[currentQuestionIndex].id]?.showFeedback && (
                          <button
                            onClick={() => checkShortAnswer(quiz.questions[currentQuestionIndex].id)}
                            disabled={!userAnswers[quiz.questions[currentQuestionIndex].id]}
                            className="w-full py-4 bg-ayb-green text-white rounded-2xl font-bold hover:bg-ayb-green/90 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-600 transition-all shadow-lg"
                          >
                            Check Answer
                          </button>
                        )}
                      </div>
                    )}

                    {/* Feedback Section */}
                    <AnimatePresence>
                      {answeredQuestions[quiz.questions[currentQuestionIndex].id]?.showFeedback && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`mt-8 p-6 rounded-2xl border-2 ${
                            answeredQuestions[quiz.questions[currentQuestionIndex].id].isCorrect
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 text-green-800 dark:text-green-400'
                              : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-800 dark:text-red-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-bold mb-2 text-lg">
                            {answeredQuestions[quiz.questions[currentQuestionIndex].id].isCorrect ? (
                              <><Check className="w-5 h-5" /> Correct!</>
                            ) : (
                              <><X className="w-5 h-5" /> Incorrect</>
                            )}
                          </div>
                          {!answeredQuestions[quiz.questions[currentQuestionIndex].id].isCorrect && (
                            <p className="text-sm mb-3">
                              <span className="font-bold uppercase tracking-widest text-[10px] opacity-60 block mb-1">Correct Answer</span>
                              <span className="font-bold text-lg">{quiz.questions[currentQuestionIndex].correctAnswer}</span>
                            </p>
                          )}
                          <div className="pt-3 border-t border-current border-opacity-10">
                            <span className="font-bold uppercase tracking-widest text-[10px] opacity-60 block mb-1">Explanation</span>
                            <p className="text-sm font-medium italic leading-relaxed">
                              {quiz.questions[currentQuestionIndex].explanation}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center justify-between pt-8 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentQuestionIndex === 0}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Previous
                    </button>
                    
                    {currentQuestionIndex === quiz.questions.length - 1 ? (
                      <button
                        onClick={submitQuiz}
                        disabled={!answeredQuestions[quiz.questions[currentQuestionIndex].id]?.showFeedback}
                        className="px-10 py-4 bg-ayb-green text-white rounded-2xl font-bold hover:bg-ayb-green/90 transition-all shadow-xl shadow-ayb-green/10 disabled:bg-gray-200 dark:disabled:bg-gray-700"
                      >
                        Finish Quiz
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentQuestionIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
                        disabled={!answeredQuestions[quiz.questions[currentQuestionIndex].id]?.showFeedback}
                        className="flex items-center gap-2 px-8 py-4 bg-gray-900 dark:bg-gray-700 text-white rounded-2xl font-bold hover:bg-black dark:hover:bg-gray-600 transition-all shadow-xl shadow-gray-200 dark:shadow-none disabled:bg-gray-200 dark:disabled:bg-gray-800"
                      >
                        Next Question
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center gap-6 text-center">
            <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 rounded-3xl flex items-center justify-center">
              <BrainCircuit className="w-12 h-12 text-gray-200 dark:text-gray-700" />
            </div>
            <div>
              <p className="text-gray-900 dark:text-white font-bold text-lg">No quiz generated</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 max-w-[320px] mx-auto">
                Upload your study materials and click "Generate Quiz" to test your knowledge with AI-crafted questions.
              </p>
              <button 
                onClick={() => setActiveTab('upload')}
                className="mt-6 px-6 py-2 bg-ayb-green text-white rounded-xl text-sm font-bold hover:bg-ayb-green/90 transition-colors"
              >
                Go to Upload
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  const renderKeyTopicsSection = () => {
    const topics = analysisResult 
      ? analysisResult.match(/#{1,3}\s+(.+)/g)?.map(t => t.replace(/#{1,3}\s+/, '')) || []
      : [];

    return (
      <motion.div
        key="key-topics"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-8"
      >
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-ayb-green/10 rounded-2xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-ayb-green" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Key Topics & Concepts</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Essential areas identified from your materials</p>
            </div>
          </div>

          {topics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topics.map((topic, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 hover:border-ayb-green transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-xs font-bold text-ayb-green group-hover:bg-ayb-green group-hover:text-white transition-colors">
                      {idx + 1}
                    </span>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{topic}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <FileCode className="w-10 h-10 text-gray-300 dark:text-gray-700" />
              </div>
              <p className="text-gray-400 dark:text-gray-500 font-medium">Upload and analyze files to see key topics</p>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderProgressSection = () => {
    const averageScore = quizHistory.length > 0 
      ? Math.round((quizHistory.reduce((acc, curr) => acc + (curr.score / curr.total), 0) / quizHistory.length) * 100)
      : 0;

    const topicStats = quizHistory.reduce((acc, item) => {
      const title = item.title || 'General';
      if (!acc[title]) acc[title] = { count: 0, totalScore: 0, totalQuestions: 0 };
      acc[title].count += 1;
      acc[title].totalScore += item.score;
      acc[title].totalQuestions += item.total;
      return acc;
    }, {} as Record<string, { count: number; totalScore: number; totalQuestions: number }>);

    const sortedTopics = Object.entries(topicStats).sort((a, b) => b[1].count - a[1].count);
    const mostFrequentTopic = sortedTopics[0]?.[0];

    const weakTopicEntry = Object.entries(topicStats)
      .map(([topic, stats]) => ({ topic, avg: stats.totalScore / stats.totalQuestions }))
      .sort((a, b) => a.avg - b.avg)[0];
    const focusTopic = weakTopicEntry?.avg < 0.7 ? weakTopicEntry.topic : null;

    const hasTechnicalTopic = quizHistory.some(item => 
      /physics|chemistry|math|science|thermodynamics|equilibrium|calculus/i.test(item.title)
    );

    return (
      <motion.div
        key="progress"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Total Quizzes</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{quizHistory.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Average Score</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{averageScore}%</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Weak Topics</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{weakTopics.length}</p>
          </div>
          <div className="bg-ayb-green p-6 rounded-3xl border border-ayb-green shadow-lg shadow-ayb-green/10 text-white">
            <p className="text-[10px] font-bold text-ayb-green/20 uppercase tracking-widest mb-1">Readiness</p>
            <p className="text-3xl font-bold">{averageScore}%</p>
          </div>
        </div>

        {quizHistory.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 bg-ayb-green/10 rounded-xl flex items-center justify-center text-xl">📊</div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">“You are {averageScore}% ready”</p>
            </div>
            
            {mostFrequentTopic && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-xl">📈</div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">“{mostFrequentTopic} appeared frequently”</p>
              </div>
            )}

            {focusTopic && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-xl">🎯</div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">“Focus on {focusTopic}”</p>
              </div>
            )}

            {hasTechnicalTopic && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-xl">🧪</div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">“Important formulas detected”</p>
              </div>
            )}

            {weakTopics.length > 0 && !focusTopic && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-center justify-center text-xl">⚠️</div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">“You are weak in some areas”</p>
              </div>
            )}
          </div>
        )}

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Quiz History</h2>
          {quizHistory.length > 0 && (
            <button 
              onClick={clearHistory}
              className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear History
            </button>
          )}
        </div>
        
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {quizHistory.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-6 text-center">
              <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center">
                <History className="w-10 h-10 text-gray-200 dark:text-gray-700" />
              </div>
              <p className="text-gray-400 dark:text-gray-500 font-medium">No quiz history yet</p>
            </div>
          ) : (
            quizHistory.map((item) => (
              <div key={item.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
                    (item.score / item.total) >= 0.7 ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                  }`}>
                    {Math.round((item.score / item.total) * 100)}%
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{item.title}</h3>
                    <p className="text-xs text-gray-400 font-medium">
                      {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{item.score} / {item.total}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Score</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </motion.div>
  );
};

  const renderVideosSection = () => (
    <motion.div
      key="videos"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Recommended Videos</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Curated educational content based on your study materials.</p>
        </div>
        {isSearchingVideos && (
          <div className="flex items-center gap-2 text-ayb-green font-bold text-sm animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            Finding videos...
          </div>
        )}
      </div>

      {videos.length === 0 && !isSearchingVideos ? (
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-16 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Youtube className="w-10 h-10 text-gray-200 dark:text-gray-700" />
          </div>
          <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No videos found yet</h4>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8">Analyze your materials first to get personalized video recommendations.</p>
          <button 
            onClick={() => setActiveTab('upload')}
            className="px-8 py-4 bg-ayb-green text-white rounded-2xl font-bold hover:bg-ayb-green-dark transition-all shadow-xl shadow-ayb-green/20"
          >
            Go to Upload
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="perspective-1000">
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                whileHover={{ 
                  scale: 1.05, 
                  rotateY: 5,
                  translateZ: 20,
                  boxShadow: "0 25px 50px -12px rgba(0, 127, 62, 0.25)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-full transform-gpu"
              >
              <div className="relative aspect-video overflow-hidden">
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <a 
                    href={`https://www.youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform duration-300 hover:bg-white/40"
                  >
                    <Play className="w-8 h-8 fill-current" />
                  </a>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest rounded-md">YouTube</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{video.channelTitle}</span>
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 leading-tight group-hover:text-ayb-green transition-colors">{video.title}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{video.description}</p>
                <a 
                  href={`https://www.youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 flex items-center gap-2 text-sm font-bold text-ayb-green hover:underline"
                >
                  Watch Video
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          </div>
          ))}
        </div>
      )}
    </motion.div>
  );

  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans selection:bg-ayb-green/20 overflow-hidden transition-colors duration-300 relative`}>
      {/* 3D Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-40 -left-40 w-96 h-96 bg-ayb-green/10 rounded-full blur-[100px] animate-float" 
        />
        <motion.div 
          animate={{ x: [0, -80, 0], y: [0, 100, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-[120px] animate-float-delayed" 
        />
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, -100, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-40 left-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-[110px]" 
        />
      </div>
      <AnimatePresence>
        {showOnboarding && renderOnboarding()}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 w-72 glass-darker border-r border-gray-200/50 dark:border-gray-800/50
        flex flex-col shrink-0 z-50 transition-all duration-500 ease-out lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        shadow-2xl lg:shadow-none
      `}>
        <div className="p-6 border-b border-gray-100/50 dark:border-gray-800/50">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ rotate: 180, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-12 h-12 bg-ayb-green rounded-2xl flex items-center justify-center shadow-2xl shadow-ayb-green/30"
            >
              <JakooLogo className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none text-gray-900 dark:text-white uppercase transition-all duration-300 group-hover:tracking-normal">JAKOO</h1>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">AYB INDUSTRIES</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-ayb-green text-white shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>

          <div className="pt-4 pb-2">
            <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Study</p>
          </div>

          <button
            onClick={() => { setActiveTab('upload'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'upload' 
                ? 'bg-ayb-green text-white shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Plus className="w-5 h-5" />
            Upload Materials
          </button>

          <div className="pt-4 pb-2">
            <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Analysis</p>
          </div>

          <button
            onClick={() => { setActiveTab('summary'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'summary' 
                ? 'bg-ayb-green text-white shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5" />
            Summary
          </button>

          <button
            onClick={() => { setActiveTab('quiz'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'quiz' 
                ? 'bg-ayb-green text-white shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BrainCircuit className="w-5 h-5" />
            Quiz
          </button>

          <button
            onClick={() => { setActiveTab('key-topics'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'key-topics' 
                ? 'bg-ayb-green text-white shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            Key Topics
          </button>

          <button
            onClick={() => { setActiveTab('progress'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'progress' 
                ? 'bg-ayb-green text-white shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Trophy className="w-5 h-5" />
            Progress
          </button>

          <button
            onClick={() => { setActiveTab('videos'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'videos' 
                ? 'bg-ayb-green text-white shadow-md' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Youtube className="w-5 h-5" />
            Study Videos
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center border border-gray-200 dark:border-gray-700">
                <Brain className="w-4 h-4 text-ayb-green" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{userName || 'Gemini 3 Flash'}</p>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{userDepartment || 'AI Engine Active'}</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div className="bg-ayb-green h-full w-3/4 rounded-full" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Top Bar */}
        <header className="h-20 glass border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between px-6 lg:px-12 shrink-0 transition-all duration-300">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg lg:hidden"
            >
              <Menu className="w-5 h-5 text-gray-500" />
            </button>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'upload' && 'Upload Center'}
              {activeTab === 'summary' && 'Analysis Summary'}
              {activeTab === 'quiz' && 'Knowledge Quiz'}
              {activeTab === 'key-topics' && 'Key Topics'}
              {activeTab === 'progress' && 'Learning Progress'}
              {activeTab === 'videos' && 'Recommended Videos'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-500" />
              )}
            </button>
            <div className="h-4 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{files.length} Files</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && renderDashboardSection()}
              {activeTab === 'upload' && renderUploadSection()}
              {activeTab === 'summary' && renderSummarySection()}
              {activeTab === 'quiz' && renderQuizSection()}
              {activeTab === 'key-topics' && renderKeyTopicsSection()}
              {activeTab === 'progress' && renderProgressSection()}
              {activeTab === 'videos' && renderVideosSection()}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? '#374151' : '#E5E7EB'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'dark' ? '#4B5563' : '#D1D5DB'};
        }
      `}</style>
    </div>
  );
}
