import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.',
    )
}

export const fetchActiveReminders = async () => {
    const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('active', true)
        .order('time', { ascending: true })

    if (error) {
        throw error
    }

    return data ?? []
}

export const insertReminder = async (payload) => {
    const { data, error } = await supabase.from('reminders').insert(payload).select('*').single()

    if (error) {
        throw error
    }

    return data
}

export const fetchHistoryLog = async () => {
    const { data, error } = await supabase.from('history').select('*').order('date', { ascending: false }).order('id', { ascending: false })

    if (error) {
        throw error
    }

    return data ?? []
}

export const deleteReminderById = async (id) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id)
    if (error) {
        throw error
    }
}

export const clearHistory = async () => {
    const { error } = await supabase.from('history').delete().gte('id', 0)
    if (error) {
        throw error
    }
}

export const markReminderTaken = async ({ reminderId, medicine, scheduledTime, takenTime, date, trigger }) => {
    const { error: reminderError } = await supabase
        .from('reminders')
        .update({
            status: 'taken',
            taken_time: takenTime,
        })
        .eq('id', reminderId)

    if (reminderError) {
        throw reminderError
    }

    const { data: existingRow, error: findError } = await supabase
        .from('history')
        .select('id')
        .eq('medicine', medicine)
        .eq('scheduled_time', scheduledTime)
        .eq('date', date)
        .maybeSingle()

    if (findError) {
        throw findError
    }

    let historyError = null
    if (existingRow?.id) {
        const { error } = await supabase
            .from('history')
            .update({
                taken_time: takenTime,
                status: 'taken',
                trigger,
            })
            .eq('id', existingRow.id)
        historyError = error
    } else {
        const { error } = await supabase.from('history').insert({
            medicine,
            scheduled_time: scheduledTime,
            taken_time: takenTime,
            status: 'taken',
            date,
            trigger,
        })
        historyError = error
    }

    if (historyError) {
        throw historyError
    }
}
