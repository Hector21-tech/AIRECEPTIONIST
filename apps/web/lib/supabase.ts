import { createClient } from '@supabase/supabase-js';

// Allow build without env vars - will be available at runtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create client only if credentials are available
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

// Admin client for server-side operations (file uploads, etc.)
// Only create admin client on server-side
export const getSupabaseAdmin = () => {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client should only be used on server-side');
  }
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Storage helpers
export const uploadAudioFile = async (
  callId: string,
  audioBase64: string
): Promise<string | null> => {
  try {
    // Convert Base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Generate filename
    const fileName = `call-${callId}-${Date.now()}.mp3`;

    // Upload to Supabase Storage using admin client to bypass RLS
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from('call-recordings')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg'
      });

    if (error) {
      console.error('Failed to upload audio:', error);
      return null;
    }

    console.log('🎧 Audio uploaded to Supabase:', fileName);
    return fileName;
  } catch (error) {
    console.error('Audio upload error:', error);
    return null;
  }
};

export const getAudioUrl = (fileName: string): string => {
  if (!supabase) {
    return '';
  }
  
  const { data } = supabase.storage
    .from('call-recordings')
    .getPublicUrl(fileName);

  return data.publicUrl;
};
